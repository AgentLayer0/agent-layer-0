/**
 * Per-swarm Algorand wallet management.
 *
 * Each registered swarm gets its own Algorand signing account so that
 * votes from different swarms have distinct on-chain identities — allowing
 * one vote per swarm per poll and unlimited parallel throughput.
 *
 * Lifecycle:
 *  1. getOrCreateSwarmWallet(swarmId)
 *       → generates account if none exists, persists encrypted mnemonic,
 *         seeds from relay wallet, returns { address, signer }
 *  2. ensureSwarmFunded(address)
 *       → tops up from relay wallet if spendable falls below TOPUP_THRESHOLD
 *         (call this before each vote to keep wallets live)
 */

import algosdk from "algosdk";
import { db } from "@workspace/db";
import { swarmWallets } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { encryptMnemonic, decryptMnemonic } from "./swarm-wallet-crypto";
import { getAlgodClient, makeRelayAddress, makeRelaySigner } from "./relay-wallet";
import { logger } from "./logger";

/** µALGO seeded into a brand-new swarm wallet (covers account min + ~17 votes). */
const SEED_AMOUNT = 500_000n;

/**
 * µALGO spendable threshold below which we top-up before a vote.
 * Must be > vote cost: 22 500 (box MBR) + 2 000 (fees) = 24 500 µALGO.
 * Set to 130 000 to cover 5 votes before triggering a top-up.
 */
const TOPUP_THRESHOLD = 130_000n;

/** µALGO sent in each top-up (enough for ~17 more votes). */
const TOPUP_AMOUNT = 500_000n;

export interface SwarmWallet {
  address: string;
  signer:  algosdk.TransactionSigner;
}

/**
 * Return the Algorand signing account for a swarm, creating it on first call.
 *
 * Thread-safety note: in a single-process server this is safe; for a
 * multi-process deployment add a DB advisory lock or upsert-on-conflict.
 */
export async function getOrCreateSwarmWallet(swarmId: string): Promise<SwarmWallet> {
  const algod = getAlgodClient();

  const rows = await db
    .select()
    .from(swarmWallets)
    .where(eq(swarmWallets.swarmId, swarmId))
    .limit(1);

  if (rows.length > 0) {
    const row      = rows[0]!;
    const mnemonic = decryptMnemonic(row.algoSkEncrypted);
    const account  = algosdk.mnemonicToSecretKey(mnemonic);
    return {
      address: row.algoAddress,
      signer:  algosdk.makeBasicAccountTransactionSigner(account),
    };
  }

  // ── First time: generate, persist, seed ──────────────────────────────────
  const account  = algosdk.generateAccount();
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
  const encrypted = encryptMnemonic(mnemonic);
  const address   = account.addr.toString();

  // Persist key BEFORE funding — so we can recover funds even if funding fails.
  await db.insert(swarmWallets).values({
    swarmId,
    algoAddress:     address,
    algoSkEncrypted: encrypted,
  });

  // Seed from relay wallet
  await _fund(address, SEED_AMOUNT, algod);

  logger.info({ swarm_id: swarmId, address }, "swarm-wallet: created and seeded");

  return {
    address,
    signer: algosdk.makeBasicAccountTransactionSigner(account),
  };
}

/**
 * Ensure the swarm wallet has enough spendable ALGO to cover at least one vote.
 * Top-ups from the relay wallet when spendable < TOPUP_THRESHOLD.
 */
export async function ensureSwarmFunded(address: string): Promise<void> {
  const algod = getAlgodClient();
  let balance: bigint;
  let minBalance: bigint;
  try {
    const info = await algod.accountInformation(address).do();
    balance    = BigInt((info as { amount?: number | bigint }).amount    ?? 0);
    minBalance = BigInt((info as { minBalance?: number | bigint }).minBalance ?? 100_000);
  } catch {
    logger.warn({ address }, "swarm-wallet: could not fetch account info before funding check");
    return;
  }

  const spendable = balance - minBalance;

  if (spendable < TOPUP_THRESHOLD) {
    logger.info(
      { address, spendable: spendable.toString(), topup: TOPUP_AMOUNT.toString() },
      "swarm-wallet: topping up",
    );
    await _fund(address, TOPUP_AMOUNT, algod);
    await db
      .update(swarmWallets)
      .set({ lastFundedAt: new Date() })
      .where(eq(swarmWallets.algoAddress, address));
  }
}

/** Send µALGO from the relay wallet to a swarm wallet. */
async function _fund(receiver: string, amount: bigint, algod: algosdk.Algodv2): Promise<void> {
  const sender = makeRelayAddress();
  const signer = makeRelaySigner();
  const sp     = await algod.getTransactionParams().do();
  const atc    = new algosdk.AtomicTransactionComposer();

  atc.addTransaction({
    txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver,
      amount,
      suggestedParams: { ...sp, flatFee: true, fee: 1000n },
    }),
    signer,
  });

  await atc.execute(algod, 4);
}
