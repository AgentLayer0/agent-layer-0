import algosdk from "algosdk";
import type { PollRecord } from "../types.js";

/**
 * Box MBR (minimum balance requirement) constants in microALGO.
 * Formula: 2500 + 400 * (key_bytes + value_bytes)
 *
 * Fixed-size boxes:
 *   BallotBox meta box:  key=10 ("m:"+uint64), value=16  (PollMeta: 2×uint64)
 *   BallotBox tally box: key=10 ("t:"+uint64), value=64  (TallyRecord: 8×uint64)
 *   BallotBox vote box:  key=42 ("v:"+uint64+pubkey32), value=8 (VoteRecord: uint64)
 *
 * PollFactory poll boxes are variable-size — use computePollBoxMbr() instead.
 */
export const BOX_MBR = {
  BALLOT_BOX_META:   12900n,
  BALLOT_BOX_TALLY:  32100n,
  BALLOT_BOX_VOTE:   22500n,
} as const;

/**
 * Compute the MBR (minimum balance requirement) for a PollFactory poll box.
 *
 * The poll box value size depends on the actual string content:
 *
 *   Head (76 bytes, fixed):
 *     creator (32) + swarm_id offset (2) + question offset (2) +
 *     option_count (8) + 8×option offsets (16) + created_at (8) + expires_at (8)
 *
 *   Tail (variable):
 *     ARC-4 strings: each is a 2-byte uint16 length + UTF-8 bytes.
 *     Unused option slots (option_count < 8) are empty ARC-4 strings = 2 bytes each.
 *
 *   Box key: 2 bytes prefix ("p:") + 8 bytes poll_id uint64 = 10 bytes.
 *
 * A 10 000 µALGO safety buffer is added to cover any minor formula variance
 * and to ensure the payment is always sufficient.
 */
export function computePollBoxMbr(
  swarm_id: string,
  question: string,
  options: string[],
): bigint {
  const enc = new TextEncoder();
  const KEY_BYTES  = 10; // "p:" (2) + uint64 (8)
  const HEAD_BYTES = 76; // fixed struct head

  const swarmBytes    = enc.encode(swarm_id).length;
  const questionBytes = enc.encode(question).length;

  const optionTailBytes = options.reduce(
    (sum, opt) => sum + 2 + enc.encode(opt).length,
    0,
  );
  const emptySlots     = 8 - options.length;
  const emptyTailBytes = emptySlots * 2; // ARC-4 empty string = 0x0000

  const valueTailBytes = (2 + swarmBytes) + (2 + questionBytes) + optionTailBytes + emptyTailBytes;
  const valueBytes     = HEAD_BYTES + valueTailBytes;

  const mbr = 2500n + 400n * BigInt(KEY_BYTES + valueBytes);

  // Add a 10 000 µALGO safety buffer
  return mbr + 10_000n;
}

/**
 * Compute and return a TransactionWithSigner that tops up the app account's
 * balance so it can cover the MBR increase from `addedBoxesMbr`.
 *
 * Returns `null` if the app account already has sufficient balance.
 *
 * Must be added to the ATC *before* the app call so the payment is confirmed
 * in the same atomic group.
 */
export async function mbrTopUp(
  algod: algosdk.Algodv2,
  appId: number,
  addedBoxesMbr: bigint,
  sender: string,
  suggestedParams: algosdk.SuggestedParams,
  signer: algosdk.TransactionSigner,
): Promise<algosdk.TransactionWithSigner | null> {
  const appAddr = algosdk.getApplicationAddress(appId).toString();

  let currentBalance = 0n;
  let currentMinBalance = 100000n;
  try {
    const info = await algod.accountInformation(appAddr).do();
    currentBalance = BigInt(info.amount ?? 0);
    const minBal = info.minBalance;
    if (minBal != null) currentMinBalance = BigInt(minBal);
  } catch {
    // Account may not exist on-chain yet; treat as zero
  }

  const newMinBalance = currentMinBalance + addedBoxesMbr;
  const needed = newMinBalance - currentBalance;
  if (needed <= 0n) return null;

  return {
    txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver: appAddr,
      amount: needed,
      suggestedParams,
    }),
    signer,
  };
}

/**
 * Manually decode a PollFactory poll box value into a PollRecord.
 *
 * algosdk v3's ABIType.decode has a confirmed bug ("dynamic index segment
 * miscalculation") for this specific tuple shape. This parser reads the
 * ARC-4 encoded bytes directly based on the confirmed on-chain layout:
 *
 * Head (76 bytes):
 *   0-31  creator pubkey  (static, 32 bytes)
 *   32-33 swarm_id offset (uint16 big-endian, absolute from byte 0)
 *   34-35 question offset (uint16 big-endian)
 *   36-43 option_count    (static, uint64 big-endian)
 *   44-59 option[0..7] offsets (8 × uint16 big-endian)
 *   60-67 created_at      (static, uint64 big-endian)
 *   68-75 expires_at      (static, uint64 big-endian)
 *
 * Tail: ARC-4 strings — each is a 2-byte big-endian length followed by UTF-8 bytes.
 */
export function parsePollBoxBytes(bytes: Uint8Array): PollRecord {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const creatorPk = bytes.slice(0, 32);
  const creator = algosdk.encodeAddress(creatorPk);

  const option_count = view.getBigUint64(36);
  const created_at  = view.getBigUint64(60);
  const expires_at  = view.getBigUint64(68);

  function readArc4String(offset: number): string {
    const len = view.getUint16(offset);
    return new TextDecoder().decode(bytes.slice(offset + 2, offset + 2 + len));
  }

  const swarm_id = readArc4String(view.getUint16(32));
  const question  = readArc4String(view.getUint16(34));

  const optionOffsets = [44, 46, 48, 50, 52, 54, 56, 58].map(h => view.getUint16(h));
  const [o0, o1, o2, o3, o4, o5, o6, o7] = optionOffsets.map(readArc4String);

  return {
    creator,
    swarm_id,
    question,
    option_count,
    option_0: o0 ?? "",
    option_1: o1 ?? "",
    option_2: o2 ?? "",
    option_3: o3 ?? "",
    option_4: o4 ?? "",
    option_5: o5 ?? "",
    option_6: o6 ?? "",
    option_7: o7 ?? "",
    created_at,
    expires_at,
  };
}
