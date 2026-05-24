/**
 * Simulates 25 independent AI agents casting votes on a freshly-created poll.
 *
 * Safety: ephemeral account keys are written to /tmp/sim-agents.json immediately
 * after generation so funds can be recovered manually if the script is interrupted.
 *
 * Steps:
 *  1. Create a poll via the relay API
 *  2. Generate 25 ephemeral Algorand accounts (keys persisted to /tmp/sim-agents.json)
 *  3. Fund all 25 in two batched atomic groups (16 + 9 payments, 2 confirmations total)
 *  4. Cast all 25 votes in parallel batches of 5
 *  5. Close out all 25 wallets in two batched atomic groups (2 confirmations total)
 *  6. Print the final on-chain tally and clean up /tmp/sim-agents.json
 */

import algosdk from "algosdk";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { BallotBoxClient } from "@workspace/al0-contracts";

// ─── Config ──────────────────────────────────────────────────────────────────

const ALGOD_URL   = "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = "";

const BALLOT_BOX_APP_ID = 763222455;

const API_KEY  = "al0_sk_QpLzNkivV-wdDf01fkYDDFlP0B8wlbTw";
const API_BASE = "http://localhost:80/api";

const NUM_AGENTS  = 25;
// 130 000 µALGO per wallet: 100 000 account min + 22 500 vote-box MBR + 7 500 fee buffer
const FUND_AMOUNT = 130_000n;
const BATCH_SIZE  = 16; // Algorand max txns per atomic group

const KEYS_FILE = "/tmp/sim-agents.json";

const QUESTION = "Should AL0 expand to L2 chains?";
const OPTIONS  = ["Yes", "No", "Abstain"] as [string, string, string];

// Vote distribution: 13 Yes, 8 No, 4 Abstain
const VOTE_OPTIONS = [
  ...Array(13).fill(0),
  ...Array(8).fill(1),
  ...Array(4).fill(2),
];

const VOTE_BATCH = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  AL0 — 25-Agent Swarm Vote Simulation");
  console.log("══════════════════════════════════════════════════\n");

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");

  const mnemonic = process.env["RELAY_WALLET_MNEMONIC"] ?? process.env["ALGO_MNEMONIC"];
  if (!mnemonic) throw new Error("RELAY_WALLET_MNEMONIC or ALGO_MNEMONIC env var is not set");
  const relayAccount = algosdk.mnemonicToSecretKey(mnemonic);
  const relayAddr    = relayAccount.addr.toString();
  const relaySk      = relayAccount.sk;

  const relayInfoBefore = await algod.accountInformation(relayAddr).do();
  const relayBalanceBefore = Number(relayInfoBefore.amount);
  const relayMin           = Number(relayInfoBefore.minBalance ?? 100_000);
  const relaySpendable     = relayBalanceBefore - relayMin;

  console.log(`Relay wallet : ${relayAddr}`);
  console.log(`Balance      : ${(relayBalanceBefore / 1e6).toFixed(3)} ALGO  (spendable: ${(relaySpendable / 1e6).toFixed(3)} ALGO)`);

  const needed = Number(FUND_AMOUNT) * NUM_AGENTS + 500_000; // agents + MBR margin
  if (relaySpendable < needed) {
    throw new Error(
      `Relay wallet has insufficient balance for simulation.\n` +
      `  Need  : ~${(needed / 1e6).toFixed(3)} ALGO spendable\n` +
      `  Have  : ${(relaySpendable / 1e6).toFixed(3)} ALGO spendable\n` +
      `  Top up: https://bank.testnet.algorand.network → ${relayAddr}`,
    );
  }
  console.log();

  // ── Step 1: Create poll via relay API ───────────────────────────────────────
  console.log("── Step 1: Creating poll via relay API ─────────────────────");
  const expiresAt = Math.floor(Date.now() / 1000) + 7200;

  const pollResp = await fetch(`${API_BASE}/relay/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify({
      swarm_id: "smoke-test-swarm-01",
      question: QUESTION,
      options: OPTIONS,
      expires_at: expiresAt,
    }),
  });

  if (!pollResp.ok) {
    const body = await pollResp.text();
    throw new Error(`Failed to create poll: ${pollResp.status} — ${body}`);
  }

  const pollData = await pollResp.json() as { pollId: string; txId: string; initTxId: string };
  const pollId   = Number(pollData.pollId);
  console.log(`Poll created : poll_id=${pollId}`);
  console.log(`Create tx    : ${pollData.txId}`);
  console.log(`Init tx      : ${pollData.initTxId}\n`);

  // ── Step 2: Generate ephemeral accounts & persist keys ────────────────────
  console.log(`── Step 2: Generating ${NUM_AGENTS} ephemeral agent accounts ──────────────`);
  const rawAgents = Array.from({ length: NUM_AGENTS }, () => algosdk.generateAccount());

  // Persist keys immediately — if the script is killed after funding, run
  // scripts/src/recover-sim-agents.ts to close out the wallets manually.
  writeFileSync(KEYS_FILE, JSON.stringify(
    rawAgents.map(a => ({ addr: a.addr.toString(), sk: Buffer.from(a.sk).toString("hex") })),
    null,
    2,
  ));
  console.log(`Keys saved   : ${KEYS_FILE}  (delete after successful close-out)\n`);

  const agents = rawAgents.map((account, i) => {
    const signer: algosdk.TransactionSigner = async (txns, idxs) =>
      idxs.map(j => txns[j].signTxn(account.sk));
    return { id: i + 1, account, addr: account.addr.toString(), signer, voteOption: VOTE_OPTIONS[i]! };
  });

  // ── Step 3: Fund all agents in batched atomic groups ─────────────────────
  console.log(`── Step 3: Funding ${NUM_AGENTS} wallets (batched groups, fast) ───────────`);
  console.log(`${Number(FUND_AMOUNT) / 1000} mALGO each × ${NUM_AGENTS} = ${(Number(FUND_AMOUNT) * NUM_AGENTS / 1e6).toFixed(3)} ALGO\n`);

  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE);
    const sp    = await algod.getTransactionParams().do();

    const txns = batch.map(agent =>
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: relayAddr,
        receiver: agent.addr,
        amount: FUND_AMOUNT,
        suggestedParams: { ...sp, flatFee: true, fee: 1000n },
      }),
    );

    algosdk.assignGroupID(txns);
    const signed = txns.map(txn => txn.signTxn(relaySk));

    await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txns[0]!.txID(), 8);

    console.log(`  Agents ${String(i + 1).padStart(2)}–${i + batch.length} funded  (group tx: ${txns[0]!.txID().slice(0, 12)}…)`);
  }
  console.log(`\nAll ${NUM_AGENTS} agents funded ✓\n`);

  // ── Step 4: Cast votes in parallel batches ─────────────────────────────────
  console.log(`── Step 4: Casting ${NUM_AGENTS} votes (${VOTE_BATCH} concurrent) ─────────────────`);
  console.log(`  Distribution: 13× Yes, 8× No, 4× Abstain\n`);

  const ballotClient = new BallotBoxClient(BALLOT_BOX_APP_ID, algod);

  for (let i = 0; i < agents.length; i += VOTE_BATCH) {
    const batch = agents.slice(i, i + VOTE_BATCH);

    const batchResults = await Promise.all(
      batch.map(async agent => {
        const sp = await algod.getTransactionParams().do();
        const { txId } = await ballotClient.castVote(
          agent.addr,
          agent.signer,
          { poll_id: pollId, option_index: agent.voteOption },
          sp,
        );
        return { agentId: agent.id, option: agent.voteOption, txId };
      }),
    );

    for (const r of batchResults) {
      const label = OPTIONS[r.option]!;
      console.log(`  Agent ${String(r.agentId).padStart(2)} → ${label.padEnd(8)} tx: ${r.txId.slice(0, 12)}…`);
    }

    if (i + VOTE_BATCH < agents.length) await sleep(300);
  }

  console.log(`\nAll ${NUM_AGENTS} votes confirmed ✓\n`);

  // ── Step 5: Close out all wallets in batched atomic groups ────────────────
  console.log(`── Step 5: Closing out ${NUM_AGENTS} wallets (batched groups, fast) ──────`);

  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE);
    const sp    = await algod.getTransactionParams().do();

    const txns = batch.map(agent =>
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: agent.addr,
        receiver: relayAddr,
        amount: 0n,
        closeRemainderTo: relayAddr,
        suggestedParams: { ...sp, flatFee: true, fee: 1000n },
      }),
    );

    algosdk.assignGroupID(txns);
    const signed = txns.map((txn, j) => txn.signTxn(batch[j]!.account.sk));

    await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txns[0]!.txID(), 8);

    console.log(`  Agents ${String(i + 1).padStart(2)}–${i + batch.length} closed  (group tx: ${txns[0]!.txID().slice(0, 12)}…)`);
  }

  // Remove key file now that wallets are closed
  if (existsSync(KEYS_FILE)) unlinkSync(KEYS_FILE);
  console.log(`\nAll wallets closed ✓  (key file removed)\n`);

  // ── Step 6: Final tally ───────────────────────────────────────────────────
  console.log("── Step 6: Final on-chain tally ────────────────────────────\n");

  const tally = await ballotClient.getTally({ poll_id: pollId });
  const counts = [tally.tally_0, tally.tally_1, tally.tally_2];
  const total  = counts.reduce((a, b) => a + b, 0n);

  console.log(`  "${QUESTION}"\n`);
  for (let i = 0; i < OPTIONS.length; i++) {
    const pct   = total > 0n ? Math.round(Number(counts[i]) * 100 / Number(total)) : 0;
    const label = OPTIONS[i]!;
    console.log(`  ${label.padEnd(10)} ${String(counts[i]).padStart(2)} votes  ${bar(pct)}  ${pct}%`);
  }
  console.log(`  ${"TOTAL".padEnd(10)} ${total} votes\n`);

  // ── Cost summary ──────────────────────────────────────────────────────────
  const relayInfoAfter    = await algod.accountInformation(relayAddr).do();
  const relayBalanceAfter = Number(relayInfoAfter.amount);
  const netCost           = (relayBalanceBefore - relayBalanceAfter) / 1e6;

  console.log("── Cost summary ────────────────────────────────────────────");
  console.log(`  Relay wallet before : ${(relayBalanceBefore / 1e6).toFixed(3)} ALGO`);
  console.log(`  Relay wallet after  : ${(relayBalanceAfter / 1e6).toFixed(3)} ALGO`);
  console.log(`  Net simulation cost : ${netCost.toFixed(3)} ALGO`);
  console.log(`  Per-vote cost       : ${(netCost / NUM_AGENTS).toFixed(4)} ALGO\n`);
  console.log("══════════════════════════════════════════════════");
  console.log("  Simulation complete!");
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌ Simulation failed:", err.message ?? err);
  process.exit(1);
});
