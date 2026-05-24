import algosdk from "algosdk";
import {
  AgentRegistryClient,
  PollFactoryClient,
  BallotBoxClient,
  getDeployedAppIds,
} from "@workspace/al0-contracts";
import { AL0Error } from "./error.js";
import { RelayClient } from "./relay.js";
import {
  parse,
  RegisterAgentSchema,
  CreatePollSchema,
  VoteSchema,
  PollIdSchema,
  type RegisterAgentInput,
  type CreatePollInput,
  type VoteInput,
} from "./validate.js";
import type {
  ClientConfig,
  Poll,
  PollResults,
  RegisterAgentResult,
  CreatePollResult,
  VoteResult,
} from "./types.js";
import { isApiKeyConfig, isMnemonicConfig } from "./types.js";

const TESTNET_ALGOD = "https://testnet-api.algonode.cloud";
const MAINNET_ALGOD = "https://mainnet-api.algonode.cloud";

function resolveAlgodUrl(
  rpc: string | undefined,
  network: string | undefined
): string {
  if (rpc) return rpc;
  if (network === "mainnet") return MAINNET_ALGOD;
  return TESTNET_ALGOD;
}

interface MnemonicContext {
  account: algosdk.Account;
  algod: algosdk.Algodv2;
  signer: algosdk.TransactionSigner;
  registry: AgentRegistryClient;
  factory: PollFactoryClient;
  ballot: BallotBoxClient;
  registryAppId: number;
  factoryAppId: number;
  ballotAppId: number;
}

function buildPollFromRecord(
  id: bigint,
  raw: {
    creator: string;
    swarm_id: string;
    question: string;
    option_count: bigint;
    option_0: string;
    option_1: string;
    option_2: string;
    option_3: string;
    option_4: string;
    option_5: string;
    option_6: string;
    option_7: string;
    created_at: bigint;
    expires_at: bigint;
  },
  isActive: boolean
): Poll {
  const count = Number(raw.option_count);
  const allOptions = [
    raw.option_0,
    raw.option_1,
    raw.option_2,
    raw.option_3,
    raw.option_4,
    raw.option_5,
    raw.option_6,
    raw.option_7,
  ];
  return {
    id,
    question: raw.question,
    swarmId: raw.swarm_id,
    creator: raw.creator,
    options: allOptions.slice(0, count),
    optionCount: count,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    isActive,
  };
}

export class AL0Client {
  private readonly mode: "apiKey" | "mnemonic";
  private relay?: RelayClient;
  private ctx?: MnemonicContext;

  constructor(config: ClientConfig) {
    if (isApiKeyConfig(config)) {
      if (!config.apiKey.startsWith("al0_sk_")) {
        throw AL0Error.invalidConfig(
          'apiKey must start with "al0_sk_". Obtain one from https://agentlayer0.xyz/dashboard'
        );
      }
      this.mode = "apiKey";
      this.relay = new RelayClient(config.apiKey, config.relayUrl);
    } else if (isMnemonicConfig(config)) {
      let account: algosdk.Account;
      try {
        account = algosdk.mnemonicToSecretKey(config.mnemonic);
      } catch (err) {
        throw AL0Error.invalidConfig(
          `Invalid mnemonic: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const algodUrl = resolveAlgodUrl(config.rpc, config.network);
      const algod = new algosdk.Algodv2("", algodUrl, "");
      const signer = algosdk.makeBasicAccountTransactionSigner(account);

      const ids = getDeployedAppIds();
      const registryAppId = ids.agentRegistryAppId;
      const factoryAppId = ids.pollFactoryAppId;
      const ballotAppId = ids.ballotBoxAppId;

      this.mode = "mnemonic";
      this.ctx = {
        account,
        algod,
        signer,
        registry: new AgentRegistryClient(registryAppId, algod),
        factory: new PollFactoryClient(factoryAppId, algod),
        ballot: new BallotBoxClient(ballotAppId, algod),
        registryAppId,
        factoryAppId,
        ballotAppId,
      };
    } else {
      throw AL0Error.invalidConfig(
        "Must provide either `apiKey` or `mnemonic` in config"
      );
    }
  }

  get authMode(): "apiKey" | "mnemonic" {
    return this.mode;
  }

  async registerAgent(
    input: RegisterAgentInput
  ): Promise<RegisterAgentResult> {
    const { swarmId } = parse(RegisterAgentSchema, input);

    if (this.mode === "apiKey") {
      try {
        return await this.relay!.registerAgent({ swarmId });
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const registryAppId = await ctx.registry.registerSwarm(
        ctx.account.addr.toString(),
        ctx.signer,
        { swarm_id: swarmId }
      );
      return { swarmId, registryAppId };
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }

  async createPoll(input: CreatePollInput): Promise<CreatePollResult> {
    const { swarmId, question, options, expiresAt } = parse(
      CreatePollSchema,
      input
    );

    if (options.length < 2 || options.length > 8) {
      throw AL0Error.invalidInput("options must contain 2–8 entries");
    }

    if (this.mode === "apiKey") {
      try {
        return await this.relay!.createPoll({
          swarmId,
          question,
          options,
          expiresAt,
        });
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const pollId = await ctx.factory.createPoll(
        ctx.account.addr.toString(),
        ctx.signer,
        {
          swarm_id: swarmId,
          question,
          options: options as [string, string, ...string[]],
          expires_at: expiresAt,
        },
        ctx.registryAppId
      );

      await ctx.ballot.initPoll(
        ctx.account.addr.toString(),
        ctx.signer,
        { poll_id: pollId },
        ctx.factoryAppId
      );

      return { pollId };
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }

  async vote(input: VoteInput): Promise<VoteResult> {
    const { pollId, optionIndex } = parse(VoteSchema, input);
    const pollIdBig = BigInt(pollId);

    if (this.mode === "apiKey") {
      try {
        return await this.relay!.vote({ pollId: pollIdBig, optionIndex });
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const isActive = await ctx.factory.isActive({ poll_id: pollIdBig });
      if (!isActive) {
        throw AL0Error.pollExpired(pollIdBig);
      }

      const hasVoted = await ctx.ballot.hasVoted({
        poll_id: pollIdBig,
        voter: ctx.account.addr.toString(),
      });
      if (hasVoted) {
        throw AL0Error.alreadyVoted(pollIdBig);
      }

      await ctx.ballot.castVote(ctx.account.addr.toString(), ctx.signer, {
        poll_id: pollIdBig,
        option_index: optionIndex,
      });

      return { pollId: pollIdBig, optionIndex };
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }

  async getPoll(pollId: bigint | number): Promise<Poll> {
    const id = parse(PollIdSchema, pollId);
    const idBig = BigInt(id);

    if (this.mode === "apiKey") {
      try {
        return await this.relay!.getPoll(idBig);
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const [record, isActive] = await Promise.all([
        ctx.factory.getPoll({ poll_id: idBig }),
        ctx.factory.isActive({ poll_id: idBig }),
      ]);
      return buildPollFromRecord(idBig, record, isActive);
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }

  async getResults(pollId: bigint | number): Promise<PollResults> {
    const id = parse(PollIdSchema, pollId);
    const idBig = BigInt(id);

    if (this.mode === "apiKey") {
      try {
        return await this.relay!.getResults(idBig);
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const tally = await ctx.ballot.getTally({ poll_id: idBig });
      const meta = await ctx.factory.getPollMeta({ poll_id: idBig });
      const count = Number(meta.option_count);
      const allTallies = [
        tally.tally_0,
        tally.tally_1,
        tally.tally_2,
        tally.tally_3,
        tally.tally_4,
        tally.tally_5,
        tally.tally_6,
        tally.tally_7,
      ];
      const tallies = allTallies.slice(0, count);
      const totalVotes = tallies.reduce((sum, t) => sum + t, 0n);
      return { pollId: idBig, tallies, totalVotes };
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }

  async listPolls(): Promise<Poll[]> {
    if (this.mode === "apiKey") {
      try {
        return await this.relay!.listPolls();
      } catch (err) {
        throw AL0Error.fromUnknown(err, "RELAY_ERROR");
      }
    }

    const ctx = this.ctx!;
    try {
      const nextId = await ctx.factory.getNextPollId();
      if (nextId === 0n) return [];

      const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i));
      const polls = await Promise.all(
        ids.map(async (id) => {
          const [record, isActive] = await Promise.all([
            ctx.factory.getPoll({ poll_id: id }),
            ctx.factory.isActive({ poll_id: id }),
          ]);
          return buildPollFromRecord(id, record, isActive);
        })
      );
      return polls;
    } catch (err) {
      throw AL0Error.fromUnknown(err);
    }
  }
}
