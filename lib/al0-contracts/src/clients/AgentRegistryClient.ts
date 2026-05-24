/**
 * Typed client stub for AgentRegistry.
 *
 * Generated from: lib/algorand-contracts/artifacts/agent_registry/AgentRegistry.arc32.json
 *
 * ABI signature reference:
 *   register_swarm(string)uint64
 *   get_owner(string)address
 *   is_registered(string)bool
 *   get_total_swarms()uint64
 *
 * Box storage (AgentRegistry):
 *   b"s:" + arc4_string(swarm_id)  →  SwarmRecord { owner: Address, registered_at: UInt64 }
 */

import algosdk from "algosdk";
import {
  refsRegisterSwarm,
  refsSwarmLookup,
} from "./boxes.js";

// ─── Method definitions (from ARC-32 ABI) ────────────────────────────────────

const M = {
  register_swarm: new algosdk.ABIMethod({
    name: "register_swarm",
    desc: "Register a new swarm under the calling address. Reverts if already registered.",
    args: [{ name: "swarm_id", type: "string", desc: "Unique identifier string (max 64 bytes)." }],
    returns: { type: "uint64", desc: "The current application ID (on-chain reference for the caller)." },
  }),
  get_owner: new algosdk.ABIMethod({
    name: "get_owner",
    args: [{ name: "swarm_id", type: "string" }],
    returns: { type: "address" },
  }),
  is_registered: new algosdk.ABIMethod({
    name: "is_registered",
    args: [{ name: "swarm_id", type: "string" }],
    returns: { type: "bool" },
  }),
  get_total_swarms: new algosdk.ABIMethod({
    name: "get_total_swarms",
    args: [],
    returns: { type: "uint64" },
  }),
} as const;

// ─── Argument types ───────────────────────────────────────────────────────────

export interface RegisterSwarmArgs {
  swarm_id: string;
}

export interface GetOwnerArgs {
  swarm_id: string;
}

export interface IsRegisteredArgs {
  swarm_id: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class AgentRegistryClient {
  constructor(
    readonly appId: number,
    private readonly algod: algosdk.Algodv2
  ) {}

  /**
   * register_swarm(string)uint64
   *
   * Register a new swarm under the calling address.
   * Reverts if the swarm_id is already registered or longer than 64 bytes.
   *
   * Box refs: swarm record box (write).
   *
   * @returns The AgentRegistry application ID.
   */
  async registerSwarm(
    sender: string,
    signer: algosdk.TransactionSigner,
    args: RegisterSwarmArgs,
    sp?: algosdk.SuggestedParams
  ): Promise<{ appId: bigint; txId: string }> {
    const suggestedParams = sp ?? (await this.algod.getTransactionParams().do());
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.register_swarm,
      methodArgs: [args.swarm_id],
      sender,
      signer,
      suggestedParams,
      boxes: refsRegisterSwarm(args.swarm_id),
    });
    const result = await atc.execute(this.algod, 4);
    return {
      appId: result.methodResults[0]!.returnValue as bigint,
      txId: result.txIDs[0]!,
    };
  }

  /**
   * get_owner(string)address  [readonly — uses simulate]
   *
   * Box refs: swarm record box (read).
   *
   * @returns The owner address of the given swarm.
   */
  async getOwner(args: GetOwnerArgs): Promise<string> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_owner,
      methodArgs: [args.swarm_id],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsSwarmLookup(args.swarm_id),
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as string;
  }

  /**
   * is_registered(string)bool  [readonly — uses simulate]
   *
   * Box refs: swarm record box (existence check).
   *
   * @returns True if the swarm_id has been registered.
   */
  async isRegistered(args: IsRegisteredArgs): Promise<boolean> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.is_registered,
      methodArgs: [args.swarm_id],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
      boxes: refsSwarmLookup(args.swarm_id),
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as boolean;
  }

  /**
   * get_total_swarms()uint64  [readonly — uses simulate]
   *
   * Reads only global state — no box refs required.
   *
   * @returns Total number of swarms registered.
   */
  async getTotalSwarms(): Promise<bigint> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: this.appId,
      method: M.get_total_swarms,
      methodArgs: [],
      sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      signer: algosdk.makeEmptyTransactionSigner(),
      suggestedParams,
    });
    const simResult = await atc.simulate(this.algod);
    return simResult.methodResults[0]!.returnValue as bigint;
  }
}
