import { z } from "zod/v4";
import { AL0Error } from "./error.js";
import type {
  Poll,
  PollResults,
  RegisterAgentResult,
  CreatePollResult,
  VoteResult,
} from "./types.js";

const DEFAULT_RELAY_URL = "https://agentlayer0.io";

const bigintLike = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v) => BigInt(v));

const RelayPollSchema = z.object({
  id: bigintLike,
  question: z.string(),
  swarmId: z.string(),
  creator: z.string(),
  options: z.array(z.string()),
  optionCount: z.number().int(),
  createdAt: bigintLike,
  expiresAt: bigintLike,
  isActive: z.boolean(),
});

const RelayPollListSchema = z.array(RelayPollSchema);

const RelayPollResultsSchema = z.object({
  pollId: bigintLike,
  tallies: z.array(bigintLike),
  totalVotes: bigintLike,
});

const RelayRegisterAgentResultSchema = z.object({
  swarm_id: z.string(),
  appId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
});

const RelayCreatePollResultSchema = z.object({
  pollId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
});

const RelayVoteResultSchema = z.object({
  poll_id: z.number(),
  option_index: z.number(),
});

export interface RelayRegisterAgentParams {
  swarmId: string;
}

export interface RelayCreatePollParams {
  swarmId: string;
  question: string;
  options: string[];
  expiresAt: number;
}

export interface RelayVoteParams {
  pollId: bigint | number;
  optionIndex: number;
}

export class RelayClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, relayUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (relayUrl ?? DEFAULT_RELAY_URL).replace(/\/$/, "");
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body, replacer) : undefined,
      });
    } catch (err) {
      throw new AL0Error(
        `Network error reaching relay: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR",
        err
      );
    }

    if (!response.ok) {
      let message = `Relay returned HTTP ${response.status}`;
      try {
        const json = (await response.json()) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        // ignore parse error, use default message
      }

      if (response.status === 401 || response.status === 403) {
        throw new AL0Error(message, "UNAUTHORIZED");
      }
      if (response.status === 404) {
        throw new AL0Error(message, "NOT_FOUND");
      }
      if (response.status === 409) {
        throw new AL0Error(message, "ALREADY_EXISTS");
      }
      throw new AL0Error(message, "RELAY_ERROR");
    }

    return response.json();
  }

  async registerAgent(
    params: RelayRegisterAgentParams
  ): Promise<RegisterAgentResult> {
    const raw = await this.request("POST", "/api/relay/register", {
      swarm_id: params.swarmId,
    });
    const parsed = RelayRegisterAgentResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for registerAgent", "RELAY_ERROR");
    }
    return { swarmId: parsed.data.swarm_id, registryAppId: parsed.data.appId };
  }

  async createPoll(params: RelayCreatePollParams): Promise<CreatePollResult> {
    const raw = await this.request("POST", "/api/relay/poll", {
      swarm_id: params.swarmId,
      question: params.question,
      options: params.options,
      expires_at: params.expiresAt,
    });
    const parsed = RelayCreatePollResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for createPoll", "RELAY_ERROR");
    }
    return { pollId: parsed.data.pollId };
  }

  async vote(params: RelayVoteParams): Promise<VoteResult> {
    const raw = await this.request("POST", "/api/relay/vote", {
      poll_id: Number(params.pollId),
      option_index: params.optionIndex,
    });
    const parsed = RelayVoteResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for vote", "RELAY_ERROR");
    }
    return {
      pollId: BigInt(parsed.data.poll_id),
      optionIndex: parsed.data.option_index,
    };
  }

  async getPoll(pollId: bigint | number): Promise<Poll> {
    const raw = await this.request("GET", `/api/relay/polls/${pollId}`);
    const parsed = RelayPollSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for getPoll", "RELAY_ERROR");
    }
    return parsed.data;
  }

  async getResults(pollId: bigint | number): Promise<PollResults> {
    const raw = await this.request(
      "GET",
      `/api/relay/polls/${pollId}/results`
    );
    const parsed = RelayPollResultsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for getResults", "RELAY_ERROR");
    }
    return parsed.data;
  }

  async listPolls(): Promise<Poll[]> {
    const raw = await this.request("GET", "/api/relay/polls");
    const parsed = RelayPollListSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AL0Error("Invalid relay response for listPolls", "RELAY_ERROR");
    }
    return parsed.data;
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}
