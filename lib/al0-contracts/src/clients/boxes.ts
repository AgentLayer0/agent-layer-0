/**
 * Box key encoding helpers for Agent Layer 0 contracts.
 *
 * All three contracts use BoxMap with a string prefix. The key stored in the
 * AVM is: prefix_bytes + arc4_encoded_key.
 *
 * Key encoding by type:
 *   arc4.String  → 2-byte big-endian length + UTF-8 bytes
 *   arc4.UInt64  → 8-byte big-endian
 *   arc4.Address → 32-byte public key
 *
 * Box storage layout per contract:
 *
 *   AgentRegistry:
 *     b"s:" + arc4_string(swarm_id)   → SwarmRecord
 *
 *   PollFactory:
 *     b"p:" + arc4_uint64(poll_id)    → PollRecord
 *
 *   BallotBox:
 *     b"m:" + arc4_uint64(poll_id)    → PollMeta  (cached from PollFactory)
 *     b"t:" + arc4_uint64(poll_id)    → TallyRecord
 *     b"v:" + arc4_uint64(poll_id) + voter_public_key(32)  → VoteRecord
 *
 * Resource pooling note:
 *   The Algorand AVM resource pool allows inner transactions (e.g. inner app
 *   calls issued by create_poll or init_poll) to access boxes that are declared
 *   in the *outer* transaction's box reference array. Therefore all box refs for
 *   both the outer and inner (cross-contract) accesses must be declared in the
 *   SDK call's `boxes` array.
 */

import algosdk from "algosdk";

const encoder = new TextEncoder();

/**
 * Encode a string using ARC-4 (2-byte big-endian length prefix + UTF-8 bytes).
 * This matches how puyapy encodes arc4.String values in box keys.
 */
function arc4String(value: string): Uint8Array {
  const utf8 = encoder.encode(value);
  const len = new Uint8Array(2);
  new DataView(len.buffer).setUint16(0, utf8.length, false);
  return concat(len, utf8);
}

/**
 * Encode a uint64 as 8 big-endian bytes.
 * This matches how puyapy encodes arc4.UInt64 values in box keys.
 */
function arc4UInt64(value: bigint | number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(value), false);
  return buf;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ─── Key builders ─────────────────────────────────────────────────────────────

/**
 * AgentRegistry: box key for a swarm record.
 * Layout: b"s:" + arc4_string(swarm_id)
 */
export function swarmBoxKey(swarmId: string): Uint8Array {
  return concat(encoder.encode("s:"), arc4String(swarmId));
}

/**
 * PollFactory: box key for a poll record.
 * Layout: b"p:" + arc4_uint64(poll_id)
 */
export function pollBoxKey(pollId: bigint | number): Uint8Array {
  return concat(encoder.encode("p:"), arc4UInt64(pollId));
}

/**
 * BallotBox: box key for cached poll metadata.
 * Layout: b"m:" + arc4_uint64(poll_id)
 */
export function pollMetaBoxKey(pollId: bigint | number): Uint8Array {
  return concat(encoder.encode("m:"), arc4UInt64(pollId));
}

/**
 * BallotBox: box key for the tally record.
 * Layout: b"t:" + arc4_uint64(poll_id)
 */
export function tallyBoxKey(pollId: bigint | number): Uint8Array {
  return concat(encoder.encode("t:"), arc4UInt64(pollId));
}

/**
 * BallotBox: box key for an individual vote record.
 * Layout: b"v:" + arc4_uint64(poll_id) + voter_public_key(32 bytes)
 *
 * @param voterAddress - Algorand address string (58 chars, checksummed)
 */
export function voteBoxKey(
  pollId: bigint | number,
  voterAddress: string
): Uint8Array {
  const voterPk = algosdk.decodeAddress(voterAddress).publicKey;
  return concat(encoder.encode("v:"), arc4UInt64(pollId), voterPk);
}

// ─── BoxReference builders ─────────────────────────────────────────────────────

export type BoxRef = { appIndex: number | bigint; name: Uint8Array };

/** Box ref pointing at a box owned by the app being called (appIndex = 0). */
function self(name: Uint8Array): BoxRef {
  return { appIndex: 0, name };
}

/** Box ref pointing at a box owned by a foreign app. */
function foreign(appId: number | bigint, name: Uint8Array): BoxRef {
  return { appIndex: appId, name };
}

/**
 * Box refs for AgentRegistry.register_swarm.
 * Writes: swarm record box.
 */
export function refsRegisterSwarm(swarmId: string): BoxRef[] {
  return [self(swarmBoxKey(swarmId))];
}

/**
 * Box refs for AgentRegistry.get_owner / is_registered.
 * Reads: swarm record box.
 */
export function refsSwarmLookup(swarmId: string): BoxRef[] {
  return [self(swarmBoxKey(swarmId))];
}

/**
 * Box refs for PollFactory.create_poll.
 *
 * Includes:
 *   - The AgentRegistry swarm box (read via inner transaction, covered by
 *     resource pooling when declared in the outer tx)
 *   - The PollFactory poll box being written (appIndex=0, i.e. PollFactory itself)
 *
 * @param registryAppId  - AgentRegistry application ID
 * @param swarmId        - swarm_id argument passed to create_poll
 * @param nextPollId     - value returned by PollFactory.getNextPollId()
 *                         (the ID that will be assigned to the new poll)
 */
export function refsCreatePoll(
  registryAppId: number | bigint,
  swarmId: string,
  nextPollId: bigint
): BoxRef[] {
  return [
    foreign(registryAppId, swarmBoxKey(swarmId)),
    self(pollBoxKey(nextPollId)),
  ];
}

/**
 * Box refs for PollFactory.get_poll / get_poll_meta / is_active.
 * Reads: poll record box.
 */
export function refsPollLookup(pollId: bigint | number): BoxRef[] {
  return [self(pollBoxKey(pollId))];
}

/**
 * Box refs for BallotBox.init_poll.
 *
 * Includes:
 *   - The PollFactory poll box (read via inner transaction, covered by
 *     resource pooling when declared in the outer tx)
 *   - The BallotBox poll_meta box being written
 *   - The BallotBox tally box being written
 *
 * @param pollFactoryAppId - PollFactory application ID
 * @param pollId           - the poll being initialised
 */
export function refsInitPoll(
  pollFactoryAppId: number | bigint,
  pollId: bigint | number
): BoxRef[] {
  return [
    foreign(pollFactoryAppId, pollBoxKey(pollId)),
    self(pollMetaBoxKey(pollId)),
    self(tallyBoxKey(pollId)),
  ];
}

/**
 * Box refs for BallotBox.cast_vote.
 *
 * Includes:
 *   - poll_meta box (read for expiry/option count check)
 *   - vote box (written — sender is the voter)
 *   - tally box (read + written)
 *
 * @param sender - the address casting the vote (must match the transaction sender)
 */
export function refsCastVote(
  pollId: bigint | number,
  sender: string
): BoxRef[] {
  return [
    self(pollMetaBoxKey(pollId)),
    self(voteBoxKey(pollId, sender)),
    self(tallyBoxKey(pollId)),
  ];
}

/**
 * Box refs for BallotBox.get_tally.
 * Reads: tally box.
 */
export function refsTallyLookup(pollId: bigint | number): BoxRef[] {
  return [self(tallyBoxKey(pollId))];
}

/**
 * Box refs for BallotBox.has_voted / get_vote.
 * Reads: vote box.
 */
export function refsVoteLookup(
  pollId: bigint | number,
  voter: string
): BoxRef[] {
  return [self(voteBoxKey(pollId, voter))];
}
