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
  pollBoxKey,
} from "./boxes.js";
import { computePollBoxMbr, mbrTopUp, parsePollBoxBytes } from "./utils.js";

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

    // Fund the PollFactory app account for the new poll box MBR.
    // The MBR is variable — it depends on the actual string content.
    const pollBoxMbr = computePollBoxMbr(args.swarm_id, args.question, args.options);
    const topUp = await mbrTopUp(
      this.algod, this.appId, pollBoxMbr,
      sender, suggestedParams, signer,
    );
    if (topUp) atc.addTransaction(topUp);

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
    const boxName = pollBoxKey(args.poll_id);
    const boxResult = await this.algod
      .getApplicationBoxByName(this.appId, boxName)
      .do();
    return parsePollBoxBytes(boxResult.value);
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
    const boxName = pollBoxKey(args.poll_id);
    const boxResult = await this.algod
      .getApplicationBoxByName(this.appId, boxName)
      .do();
    const r = parsePollBoxBytes(boxResult.value);
    return { expires_at: r.expires_at, option_count: r.option_count };
  }

  /**
   * is_active(uint64)bool  [readonly — uses simulate]
   *
   * Box refs: poll record box (read for expiry check).
   *
   * @returns True if the poll exists and has not expired.
   */
  async isActive(args: IsActiveArgs): Promise<boolean> {
    try {
      const boxName = pollBoxKey(args.poll_id);
      const boxResult = await this.algod
        .getApplicationBoxByName(this.appId, boxName)
        .do();
      const r = parsePollBoxBytes(boxResult.value);
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      return r.expires_at > nowSec;
    } catch {
      return false;
    }
  }

  /**
   * get_next_poll_id()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns The poll ID that will be assigned to the next poll.
   */
  async getNextPollId(): Promise<bigint> {
    return this._readGlobalUint("next_poll_id");
  }

  /**
   * get_registry_app_id()uint64  [readonly — reads global state directly]
   *
   * @returns The AgentRegistry app ID this factory is linked to.
   */
  async getRegistryAppId(): Promise<bigint> {
    return this._readGlobalUint("registry_app_id");
  }

  /**
   * Read a uint global-state value by key name directly from the algod REST API.
   * Avoids simulate which does not decode ABI return values in algosdk v3.
   */
  private async _readGlobalUint(keyName: string): Promise<bigint> {
    const info = await this.algod.getApplicationByID(this.appId).do();
    const globalState = (info.params.globalState ?? []) as Array<{
      key: Uint8Array;
      value: { type: number; uint: bigint | string };
    }>;
    const target = Buffer.from(keyName, "utf8");
    for (const entry of globalState) {
      if (Buffer.from(entry.key).equals(target)) {
        return BigInt(entry.value.uint);
      }
    }
    throw new Error(`Global state key "${keyName}" not found in app ${this.appId}`);
  }
}
