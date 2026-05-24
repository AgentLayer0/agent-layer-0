/**
 * Typed client stub for PollFactory.
 *
 * Generated from: lib/algorand-contracts/artifacts/poll_factory/PollFactory.arc32.json
 *
 * ABI signature reference:
 *   bootstrap(uint64)void
 *   create_poll(string,string,string,string,string,string,string,string,string,string,uint64,uint64)uint64
 *   get_poll(uint64)(address,string,string,uint64,string,string,string,string,string,string,string,string,uint64,uint64)
 *   get_poll_meta(uint64)(uint64,uint64)
 *   is_active(uint64)bool
 *   get_next_poll_id()uint64
 *   get_registry_app_id()uint64
 *
 * Box storage (PollFactory):
 *   b"p:" + arc4_uint64(poll_id)  →  PollRecord struct
 *
 * Cross-contract note (create_poll):
 *   create_poll issues an inner transaction to AgentRegistry.get_owner to verify
 *   swarm ownership. The Algorand AVM resource pool allows that inner transaction
 *   to access AgentRegistry boxes that are declared in the **outer** transaction's
 *   box reference array. Both the AgentRegistry swarm box and the PollFactory
 *   poll box are therefore included in create_poll's box refs.
 *
 * Fee budget:
 *   create_poll: set fee to 2× minFee (outer tx + inner AgentRegistry call).
 *   All other methods: standard 1× minFee.
 */

import algosdk from "algosdk";
import type { PollRecord, PollMeta } from "../types.js";
import {
  refsCreatePoll,
  refsPollLookup,
} from "./boxes.js";

// ─── Method definitions (from ARC-32 ABI) ────────────────────────────────────

const M = {
  bootstrap: new algosdk.ABIMethod({
    name: "bootstrap",
    desc: "Link this PollFactory to a deployed AgentRegistry. Creator-only. Call once after deployment.",
    args: [{ name: "registry_app_id", type: "uint64", desc: "Application ID of the deployed AgentRegistry contract." }],
    returns: { type: "void" },
  }),
  create_poll: new algosdk.ABIMethod({
    name: "create_poll",
    desc: "Create a governance poll. Verifies caller is the registered swarm owner via inner transaction to AgentRegistry.",
    args: [
      { name: "swarm_id", type: "string" },
      { name: "question", type: "string" },
      { name: "option_0", type: "string" },
      { name: "option_1", type: "string" },
      { name: "option_2", type: "string" },
      { name: "option_3", type: "string" },
      { name: "option_4", type: "string" },
      { name: "option_5", type: "string" },
      { name: "option_6", type: "string" },
      { name: "option_7", type: "string" },
      { name: "option_count", type: "uint64" },
      { name: "expires_at", type: "uint64" },
    ],
    returns: { type: "uint64", desc: "Numeric poll ID (monotonically increasing)." },
  }),
  get_poll: new algosdk.ABIMethod({
    name: "get_poll",
    args: [{ name: "poll_id", type: "uint64" }],
    returns: { type: "(address,string,string,uint64,string,string,string,string,string,string,string,string,uint64,uint64)" },
  }),
  get_poll_meta: new algosdk.ABIMethod({
    name: "get_poll_meta",
    args: [{ name: "poll_id", type: "uint64" }],
    returns: { type: "(uint64,uint64)" },
  }),
  is_active: new algosdk.ABIMethod({
    name: "is_active",
    args: [{ name: "poll_id", type: "uint64" }],
    returns: { type: "bool" },
  }),
  get_next_poll_id: new algosdk.ABIMethod({
    name: "get_next_poll_id",
    args: [],
    returns: { type: "uint64" },
  }),
  get_registry_app_id: new algosdk.ABIMethod({
    name: "get_registry_app_id",
    args: [],
    returns: { type: "uint64" },
  }),
} as const;

// ─── Argument types ───────────────────────────────────────────────────────────

export interface BootstrapArgs {
  registry_app_id: bigint | number;
}

export interface CreatePollArgs {
  swarm_id: string;
  question: string;
  /** Between 2 and 8 option strings. */
  options: [string, string, ...string[]];
  expires_at: bigint | number;
}

export interface GetPollArgs {
  poll_id: bigint | number;
}

export interface GetPollMetaArgs {
  poll_id: bigint | number;
}

export interface IsActiveArgs {
  poll_id: bigint | number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const EMPTY = "";

export class PollFactoryClient {
  constructor(
    readonly appId: number,
    private readonly algod: algosdk.Algodv2
  ) {}

  /**
   * bootstrap(uint64)void
   *
   * Link this PollFactory to a deployed AgentRegistry contract.
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
      methodArgs: [BigInt(args.registry_app_id)],
      sender,
      signer,
      suggestedParams,
    });
    await atc.execute(this.algod, 4);
  }

  /**
   * create_poll(...)uint64
   *
   * Create a governance poll. The caller must be the registered swarm owner.
   * An inner transaction to AgentRegistry.get_owner validates ownership
   * on-chain — no off-chain trust required.
   *
   * Box refs (outer tx, covers inner tx via AVM resource pooling):
   *   - AgentRegistry: swarm record box (read by inner tx)
   *   - PollFactory:   new poll record box (written by this method)
   *
   * This method automatically reads PollFactory.getNextPollId() first so it
   * can include the correct poll box reference in the outer transaction.
   *
   * Fee: 2× minFee (covers the inner AgentRegistry app call).
   *
   * @param registryAppId - AgentRegistry app ID (for foreign app ref + box ref)
   * @returns The new poll ID.
   */
  async createPoll(
    sender: string,
    signer: algosdk.TransactionSigner,
    args: CreatePollArgs,
    registryAppId: number,
    sp?: algosdk.SuggestedParams
  ): Promise<{ pollId: bigint; txId: string }> {
    if (args.options.length < 2 || args.options.length > 8) {
      throw new Error("options must contain between 2 and 8 entries");
    }

    const suggestedParams = sp ?? (await this.algod.getTransactionParams().do());

    // Read the next poll ID first so we can include the correct box ref.
    const nextPollId = await this.getNextPollId();

    const paddedOptions: string[] = [...args.options];
    while (paddedOptions.length < 8) paddedOptions.push(EMPTY);

    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.create_poll,
      methodArgs: [
        args.swarm_id,
        args.question,
        ...paddedOptions,
        BigInt(args.options.length),
        BigInt(args.expires_at),
      ],
      sender,
      signer,
      suggestedParams: {
        ...suggestedParams,
        fee: BigInt(suggestedParams.minFee) * 2n,
        flatFee: true,
      },
      appForeignApps: [registryAppId],
      boxes: refsCreatePoll(registryAppId, args.swarm_id, nextPollId),
    });
    const result = await atc.execute(this.algod, 4);
    return {
      pollId: result.methodResults[0]!.returnValue as bigint,
      txId: result.txIDs[0]!,
    };
  }

  /**
   * get_poll(uint64)(...)  [readonly — uses simulate]
   *
   * Box refs: poll record box (read).
   *
   * @returns Full PollRecord for the given poll ID.
   */
  async getPoll(args: GetPollArgs): Promise<PollRecord> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_poll,
      methodArgs: [BigInt(args.poll_id)],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsPollLookup(args.poll_id),
    });
    const simResult = await atc.simulate(this.algod);
    const raw = simResult.methodResults[0]!.returnValue as unknown[];
    return {
      creator: raw[0] as string,
      swarm_id: raw[1] as string,
      question: raw[2] as string,
      option_count: raw[3] as bigint,
      option_0: raw[4] as string,
      option_1: raw[5] as string,
      option_2: raw[6] as string,
      option_3: raw[7] as string,
      option_4: raw[8] as string,
      option_5: raw[9] as string,
      option_6: raw[10] as string,
      option_7: raw[11] as string,
      created_at: raw[12] as bigint,
      expires_at: raw[13] as bigint,
    };
  }

  /**
   * get_poll_meta(uint64)(uint64,uint64)  [readonly — uses simulate]
   *
   * Lightweight metadata fetch. Also used internally by BallotBox.init_poll
   * via inner transaction (the box ref is covered by resource pooling on
   * the BallotBox.initPoll outer call).
   *
   * Box refs: poll record box (read).
   *
   * @returns PollMeta { expires_at, option_count }
   */
  async getPollMeta(args: GetPollMetaArgs): Promise<PollMeta> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_poll_meta,
      methodArgs: [BigInt(args.poll_id)],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsPollLookup(args.poll_id),
    });
    const simResult = await atc.simulate(this.algod);
    const raw = simResult.methodResults[0]!.returnValue as unknown[];
    return {
      expires_at: raw[0] as bigint,
      option_count: raw[1] as bigint,
    };
  }

  /**
   * is_active(uint64)bool  [readonly — uses simulate]
   *
   * Box refs: poll record box (read for expiry check).
   *
   * @returns True if the poll exists and has not expired.
   */
  async isActive(args: IsActiveArgs): Promise<boolean> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.is_active,
      methodArgs: [BigInt(args.poll_id)],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsPollLookup(args.poll_id),
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as boolean;
  }

  /**
   * get_next_poll_id()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns The poll ID that will be assigned to the next poll.
   */
  async getNextPollId(): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_next_poll_id,
      methodArgs: [],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }

  /**
   * get_registry_app_id()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns The AgentRegistry app ID this factory is linked to.
   */
  async getRegistryAppId(): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_registry_app_id,
      methodArgs: [],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }
}
