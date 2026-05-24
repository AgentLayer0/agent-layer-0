/**
 * Typed client stub for BallotBox.
 *
 * Generated from: lib/algorand-contracts/artifacts/ballot_box/BallotBox.arc32.json
 *
 * ABI signature reference:
 *   bootstrap(uint64)void
 *   init_poll(uint64)void
 *   cast_vote(uint64,uint64)void
 *   get_tally(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)
 *   has_voted(uint64,address)bool
 *   get_vote(uint64,address)uint64
 *   get_total_votes()uint64
 *   get_factory_app_id()uint64
 *
 * Box storage (BallotBox):
 *   b"m:" + arc4_uint64(poll_id)                          →  PollMeta (cached from PollFactory)
 *   b"t:" + arc4_uint64(poll_id)                          →  TallyRecord (8 × UInt64)
 *   b"v:" + arc4_uint64(poll_id) + voter_public_key(32)   →  VoteRecord { option_index }
 *
 * Cross-contract note (init_poll):
 *   init_poll issues an inner transaction to PollFactory.get_poll_meta to fetch
 *   authoritative poll metadata. Via AVM resource pooling, the PollFactory poll
 *   box (b"p:" + poll_id) declared in the outer transaction's box refs is
 *   accessible to that inner transaction.
 *
 * Fee budget:
 *   init_poll: 2× minFee (outer tx + inner PollFactory call).
 *   cast_vote:  1× minFee (no inner tx).
 *   All other methods: standard 1× minFee.
 */

import algosdk from "algosdk";
import type { TallyRecord } from "../types.js";
import {
  refsInitPoll,
  refsCastVote,
  refsTallyLookup,
  refsVoteLookup,
} from "./boxes.js";

// ─── Method definitions (from ARC-32 ABI) ────────────────────────────────────

const M = {
  bootstrap: new algosdk.ABIMethod({
    name: "bootstrap",
    desc: "Link this BallotBox to a deployed PollFactory. Creator-only. Call once after deployment.",
    args: [{ name: "factory_app_id", type: "uint64", desc: "Application ID of the deployed PollFactory contract." }],
    returns: { type: "void" },
  }),
  init_poll: new algosdk.ABIMethod({
    name: "init_poll",
    desc: "Initialise a poll in BallotBox. Fetches authoritative expires_at and option_count from PollFactory via inner transaction — caller cannot spoof these values.",
    args: [{ name: "poll_id", type: "uint64", desc: "The poll ID assigned by PollFactory.create_poll." }],
    returns: { type: "void" },
  }),
  cast_vote: new algosdk.ABIMethod({
    name: "cast_vote",
    args: [
      { name: "poll_id", type: "uint64" },
      { name: "option_index", type: "uint64" },
    ],
    returns: { type: "void" },
  }),
  get_tally: new algosdk.ABIMethod({
    name: "get_tally",
    args: [{ name: "poll_id", type: "uint64" }],
    returns: { type: "(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)" },
  }),
  has_voted: new algosdk.ABIMethod({
    name: "has_voted",
    args: [
      { name: "poll_id", type: "uint64" },
      { name: "voter", type: "address" },
    ],
    returns: { type: "bool" },
  }),
  get_vote: new algosdk.ABIMethod({
    name: "get_vote",
    args: [
      { name: "poll_id", type: "uint64" },
      { name: "voter", type: "address" },
    ],
    returns: { type: "uint64" },
  }),
  get_total_votes: new algosdk.ABIMethod({
    name: "get_total_votes",
    args: [],
    returns: { type: "uint64" },
  }),
  get_factory_app_id: new algosdk.ABIMethod({
    name: "get_factory_app_id",
    args: [],
    returns: { type: "uint64" },
  }),
} as const;

// ─── Argument types ───────────────────────────────────────────────────────────

export interface BootstrapArgs {
  factory_app_id: bigint | number;
}

export interface InitPollArgs {
  poll_id: bigint | number;
}

export interface CastVoteArgs {
  poll_id: bigint | number;
  option_index: bigint | number;
}

export interface GetTallyArgs {
  poll_id: bigint | number;
}

export interface HasVotedArgs {
  poll_id: bigint | number;
  voter: string;
}

export interface GetVoteArgs {
  poll_id: bigint | number;
  voter: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class BallotBoxClient {
  constructor(
    readonly appId: number,
    private readonly algod: algosdk.Algodv2
  ) {}

  /**
   * bootstrap(uint64)void
   *
   * Link this BallotBox to a deployed PollFactory contract.
   * Creator-only — must be called exactly once after deployment.
   * No box refs required (writes only global state).
   */
  async bootstrap(
    sender: string,
    signer: algosdk.TransactionSigner,
    args: BootstrapArgs,
    sp?: algosdk.SuggestedParams
  ): Promise<void> {
    const suggestedParams = sp ?? (await this.algod.getTransactionParams().do());
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.bootstrap,
      methodArgs: [BigInt(args.factory_app_id)],
      sender,
      signer,
      suggestedParams,
    });
    await atc.execute(this.algod, 4);
  }

  /**
   * init_poll(uint64)void
   *
   * Initialise a poll so votes can be cast against it.
   * Fetches authoritative metadata (expires_at, option_count) from PollFactory
   * via inner transaction — the caller cannot spoof these values.
   *
   * Box refs (outer tx, covers inner tx via AVM resource pooling):
   *   - PollFactory: poll record box (read by inner tx)
   *   - BallotBox:   poll_meta box (written — cached metadata)
   *   - BallotBox:   tally box (written — zero-initialised counters)
   *
   * Fee: 2× minFee (covers the inner PollFactory app call).
   *
   * @param pollFactoryAppId - PollFactory app ID (for foreign app ref + box ref)
   */
  async initPoll(
    sender: string,
    signer: algosdk.TransactionSigner,
    args: InitPollArgs,
    pollFactoryAppId: number,
    sp?: algosdk.SuggestedParams
  ): Promise<{ txId: string }> {
    const suggestedParams = sp ?? (await this.algod.getTransactionParams().do());
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.init_poll,
      methodArgs: [BigInt(args.poll_id)],
      sender,
      signer,
      suggestedParams: {
        ...suggestedParams,
        fee: BigInt(suggestedParams.minFee) * 2n,
        flatFee: true,
      },
      appForeignApps: [pollFactoryAppId],
      boxes: refsInitPoll(pollFactoryAppId, args.poll_id),
    });
    const result = await atc.execute(this.algod, 4);
    return { txId: result.txIDs[0]! };
  }

  /**
   * cast_vote(uint64,uint64)void
   *
   * Cast a vote on an active poll. Reverts if the poll has expired,
   * the option index is out of range, or the sender has already voted.
   * No inner transaction — standard 1× minFee.
   *
   * Box refs:
   *   - poll_meta box (read — expiry + option count check)
   *   - vote box for sender (written — dedup record)
   *   - tally box (read + written — per-option counter increment)
   *
   * @param sender - must match the transaction sender (used to compute vote box key)
   */
  async castVote(
    sender: string,
    signer: algosdk.TransactionSigner,
    args: CastVoteArgs,
    sp?: algosdk.SuggestedParams
  ): Promise<{ txId: string }> {
    const suggestedParams = sp ?? (await this.algod.getTransactionParams().do());
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.cast_vote,
      methodArgs: [BigInt(args.poll_id), BigInt(args.option_index)],
      sender,
      signer,
      suggestedParams,
      boxes: refsCastVote(args.poll_id, sender),
    });
    const result = await atc.execute(this.algod, 4);
    return { txId: result.txIDs[0]! };
  }

  /**
   * get_tally(uint64)(...)  [readonly — uses simulate]
   *
   * Box refs: tally box (read).
   *
   * @returns Per-option vote counts for the given poll.
   */
  async getTally(args: GetTallyArgs): Promise<TallyRecord> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_tally,
      methodArgs: [BigInt(args.poll_id)],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsTallyLookup(args.poll_id),
    });
    const simResult = await atc.simulate(this.algod);
    const raw = simResult.methodResults[0]!.returnValue as unknown[];
    return {
      tally_0: raw[0] as bigint,
      tally_1: raw[1] as bigint,
      tally_2: raw[2] as bigint,
      tally_3: raw[3] as bigint,
      tally_4: raw[4] as bigint,
      tally_5: raw[5] as bigint,
      tally_6: raw[6] as bigint,
      tally_7: raw[7] as bigint,
    };
  }

  /**
   * has_voted(uint64,address)bool  [readonly — uses simulate]
   *
   * Box refs: vote box for the given voter (existence check).
   *
   * @returns True if the given voter has already cast a vote on this poll.
   */
  async hasVoted(args: HasVotedArgs): Promise<boolean> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.has_voted,
      methodArgs: [BigInt(args.poll_id), args.voter],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsVoteLookup(args.poll_id, args.voter),
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as boolean;
  }

  /**
   * get_vote(uint64,address)uint64  [readonly — uses simulate]
   *
   * Box refs: vote box for the given voter (read).
   *
   * @returns The option index the given voter chose. Reverts if they have not voted.
   */
  async getVote(args: GetVoteArgs): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_vote,
      methodArgs: [BigInt(args.poll_id), args.voter],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsVoteLookup(args.poll_id, args.voter),
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }

  /**
   * get_total_votes()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns Total votes cast across all polls.
   */
  async getTotalVotes(): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_total_votes,
      methodArgs: [],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }

  /**
   * get_factory_app_id()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns The PollFactory app ID this BallotBox is linked to.
   */
  async getFactoryAppId(): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_factory_app_id,
      methodArgs: [],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }
}
