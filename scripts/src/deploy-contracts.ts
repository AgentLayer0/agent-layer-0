/**
 * Deploy Agent Layer 0 smart contracts to Algorand Testnet.
 *
 * Prerequisites:
 *   - ALGO_MNEMONIC  — 25-word mnemonic for a funded Testnet account
 *   - ALGOD_TOKEN    — Algorand node API token (default: empty string for public node)
 *   - ALGOD_SERVER   — Algorand node URL (default: https://testnet-api.algonode.cloud)
 *   - ALGOD_PORT     — Algorand node port (default: 443)
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run deploy-contracts
 *
 * Get Testnet ALGO from the faucet: https://bank.testnet.algorand.network/
 *
 * On success, writes deployed app IDs to:
 *   lib/al0-contracts/deployed-app-ids.json
 *
 * Deployment order:
 *   1. AgentRegistry  — standalone; no dependencies
 *   2. PollFactory    — bootstrap(agentRegistryAppId) links it to AgentRegistry
 *                       create_poll validates caller via inner tx to AgentRegistry
 *   3. BallotBox      — bootstrap(pollFactoryAppId) links it to PollFactory
 *                       init_poll fetches authoritative metadata via inner tx to PollFactory
 */

import algosdk from "algosdk";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const OUTPUT_PATH = join(REPO_ROOT, "lib/al0-contracts/deployed-app-ids.json");
const ARTIFACTS_ROOT = join(REPO_ROOT, "lib/algorand-contracts/artifacts");

/**
 * Maps PascalCase contract name → puyapy snake_case artifact subdirectory.
 * puyapy outputs: artifacts/<snake_case_dir>/<PascalCaseName>.<kind>.teal
 */
const ARTIFACT_DIRS: Record<string, string> = {
  AgentRegistry: "agent_registry",
  PollFactory: "poll_factory",
  BallotBox: "ballot_box",
};

/**
 * Global state uint64 slots required by each contract.
 *   AgentRegistry: total_swarms (1)
 *   PollFactory:   next_poll_id + registry_app_id (2)
 *   BallotBox:     total_votes + factory_app_id (2)
 */
const GLOBAL_INTS: Record<string, number> = {
  AgentRegistry: 1,
  PollFactory: 2,
  BallotBox: 2,
};

// ─── Configuration ────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

const MNEMONIC = requireEnv("ALGO_MNEMONIC");
const ALGOD_TOKEN = process.env["ALGOD_TOKEN"] ?? "";
const ALGOD_SERVER =
  process.env["ALGOD_SERVER"] ?? "https://testnet-api.algonode.cloud";
const ALGOD_PORT = Number(process.env["ALGOD_PORT"] ?? 443);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccount(): algosdk.Account {
  return algosdk.mnemonicToSecretKey(MNEMONIC);
}

function getAlgodClient(): algosdk.Algodv2 {
  return new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
}

async function waitForConfirmation(
  client: algosdk.Algodv2,
  txid: string
): Promise<algosdk.modelsv2.PendingTransactionResponse> {
  const status = await client.status().do();
  let lastRound = status.lastRound;

  while (true) {
    const result = await client.pendingTransactionInformation(txid).do();
    if (result.confirmedRound && result.confirmedRound > 0n) {
      return result;
    }
    lastRound += 1n;
    await client.statusAfterBlock(lastRound).do();
  }
}

/**
 * Read the TEAL source for a contract from the puyapy build output.
 * Path: artifacts/<snake_case_dir>/<PascalCaseName>.<kind>.teal
 */
function readTeal(
  contractName: string,
  kind: "approval" | "clear"
): Uint8Array {
  const dir = ARTIFACT_DIRS[contractName];
  if (!dir) throw new Error(`Unknown contract: ${contractName}`);
  const tealPath = join(
    ARTIFACTS_ROOT,
    dir,
    `${contractName}.${kind}.teal`
  );
  const source = readFileSync(tealPath, "utf-8");
  return Buffer.from(source);
}

async function compileTeal(
  client: algosdk.Algodv2,
  source: Uint8Array
): Promise<Uint8Array> {
  const result = await client.compile(source).do();
  return new Uint8Array(Buffer.from(result.result, "base64"));
}

async function deployContract(
  client: algosdk.Algodv2,
  account: algosdk.Account,
  contractName: string
): Promise<number> {
  console.log(`  Deploying ${contractName}...`);

  const approvalSource = readTeal(contractName, "approval");
  const clearSource = readTeal(contractName, "clear");

  const approvalProgram = await compileTeal(client, approvalSource);
  const clearProgram = await compileTeal(client, clearSource);

  const suggestedParams = await client.getTransactionParams().do();
  const numGlobalInts = GLOBAL_INTS[contractName] ?? 1;

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr,
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    numGlobalInts,
    numGlobalByteSlices: 0,
  });

  const signedTxn = txn.signTxn(account.sk);
  const { txid } = await client.sendRawTransaction(signedTxn).do();

  const result = await waitForConfirmation(client, txid);
  const appId = Number(result.applicationIndex ?? 0);

  console.log(`  ${contractName} deployed → App ID: ${appId} (txn: ${txid})`);
  return appId;
}

/**
 * Call the `bootstrap(linkedAppId: uint64) void` ABI method on a contract.
 *
 * This is used to link:
 *   - PollFactory → AgentRegistry  (validates swarm ownership on poll creation)
 *   - BallotBox   → PollFactory    (fetches authoritative poll metadata on init)
 */
async function callBootstrap(
  client: algosdk.Algodv2,
  account: algosdk.Account,
  appId: number,
  linkedAppId: number,
  label: string
): Promise<void> {
  console.log(
    `  Bootstrapping ${label} with linkedAppId=${linkedAppId}...`
  );

  const suggestedParams = await client.getTransactionParams().do();

  const methodSelector = new Uint8Array(
    Buffer.from(
      algosdk.ABIMethod.fromSignature("bootstrap(uint64)void").getSelector()
    )
  );
  const encodedArg = algosdk.encodeUint64(linkedAppId);

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: account.addr,
    suggestedParams,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [methodSelector, encodedArg],
    foreignApps: [linkedAppId],
  });

  const signedTxn = txn.signTxn(account.sk);
  const { txid } = await client.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(client, txid);
  console.log(`  ${label} bootstrapped (txn: ${txid})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Agent Layer 0 — Algorand Testnet deployment");
  console.log(`Node: ${ALGOD_SERVER}:${ALGOD_PORT}`);
  console.log("");

  console.log("Step 1/3 — Using pre-compiled TEAL artifacts (skipping Python build)...");
  console.log(`  Artifacts root: ${ARTIFACTS_ROOT}`);

  const client = getAlgodClient();
  const account = getAccount();
  console.log(`Deployer: ${account.addr}`);

  const accountInfo = await client.accountInformation(account.addr).do();
  console.log(`Balance: ${accountInfo.amount} microALGO`);
  console.log("");

  console.log("Step 2/3 — Deploying contracts...");

  const agentRegistryAppId = await deployContract(
    client,
    account,
    "AgentRegistry"
  );
  const pollFactoryAppId = await deployContract(
    client,
    account,
    "PollFactory"
  );
  const ballotBoxAppId = await deployContract(client, account, "BallotBox");

  console.log("");
  console.log("Step 3/3 — Bootstrapping cross-contract links...");

  // Link PollFactory → AgentRegistry so create_poll can validate swarm ownership
  await callBootstrap(
    client,
    account,
    pollFactoryAppId,
    agentRegistryAppId,
    "PollFactory → AgentRegistry"
  );

  // Link BallotBox → PollFactory so init_poll fetches authoritative metadata
  await callBootstrap(
    client,
    account,
    ballotBoxAppId,
    pollFactoryAppId,
    "BallotBox → PollFactory"
  );

  const output = {
    network: process.env["ALGORAND_NETWORK"] ?? "testnet",
    agentRegistryAppId,
    pollFactoryAppId,
    ballotBoxAppId,
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");

  console.log("");
  console.log("Deployment complete.");
  console.log("App IDs written to: lib/al0-contracts/deployed-app-ids.json");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
