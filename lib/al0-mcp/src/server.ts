import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AL0Client, AL0Error } from "@agentlayer0/sdk";

function formatError(err: unknown): string {
  if (err instanceof AL0Error) {
    switch (err.code) {
      case "POLL_EXPIRED":    return `Poll has expired. ${err.message}`;
      case "ALREADY_VOTED":   return `Already voted on this poll. ${err.message}`;
      case "ALREADY_EXISTS":  return `Already exists. ${err.message}`;
      case "NOT_FOUND":       return `Not found. ${err.message}`;
      case "UNAUTHORIZED":    return `Unauthorized. Check your AL0_API_KEY is valid.`;
      case "INVALID_INPUT":   return `Invalid input. ${err.message}`;
      case "INVALID_CONFIG":  return `Configuration error. ${err.message}`;
      case "RELAY_ERROR":     return `Relay error. ${err.message}`;
      case "NETWORK_ERROR":   return `Network error. ${err.message}`;
      default:                return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err ?? "Unknown error");
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, bigintReplacer, 2) }] };
}

function fail(err: unknown): { content: [{ type: "text"; text: string }]; isError: true } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: formatError(err) }) }],
    isError: true,
  };
}

// Direct fetch for endpoints not covered by AL0Client -------------------------

const API_BASE = (process.env["AL0_API_BASE"] ?? "https://agentlayer0.io").replace(/\/$/, "");

async function apiFetch(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json() as unknown;
  if (!res.ok) {
    const msg = (body as { error?: string }).error ?? res.statusText;
    throw new Error(msg);
  }
  return body;
}

// Lazily cache app IDs from /api/keys/me/context
type AppIds = { agentRegistryAppId?: number };
let cachedAppIds: AppIds | null = null;
async function getAppIds(apiKey: string): Promise<AppIds> {
  if (cachedAppIds) return cachedAppIds;
  const ctx = await apiFetch("/api/keys/me/context", apiKey) as { appIds: AppIds };
  cachedAppIds = ctx.appIds ?? {};
  return cachedAppIds;
}

const TOOLS = [
  {
    name: "al0_register_agent",
    description:
      "Register a new agent swarm identity on AgentLayer0. Creates an on-chain record tied to your API key. Call once per swarm before creating polls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarmId: {
          type: "string",
          description: "Unique swarm identifier (max 64 chars), e.g. 'trading-bot-v1'",
        },
      },
      required: ["swarmId"],
    },
  },
  {
    name: "al0_create_poll",
    description:
      "Create an on-chain governance poll for an AI agent swarm. Returns pollId to use when casting votes. The swarm must be registered first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarmId: { type: "string", description: "Swarm identifier (must be registered)" },
        question: { type: "string", description: "The governance question being asked" },
        options: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 8,
          description: "Array of 2–8 answer options",
        },
        expiresAt: {
          type: "integer",
          description:
            "Unix timestamp (seconds) when the poll closes, e.g. Math.floor(Date.now()/1000) + 86400",
        },
      },
      required: ["swarmId", "question", "options", "expiresAt"],
    },
  },
  {
    name: "al0_vote",
    description:
      "Cast a vote on an active on-chain governance poll. Each API key can vote once per poll.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pollId: { type: "integer", description: "Poll ID returned from al0_create_poll" },
        optionIndex: {
          type: "integer",
          minimum: 0,
          description: "Zero-based index of the chosen option",
        },
      },
      required: ["pollId", "optionIndex"],
    },
  },
  {
    name: "al0_get_poll",
    description:
      "Get full details of a governance poll including question, options, creator, and active status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pollId: { type: "integer", description: "Poll ID to fetch" },
      },
      required: ["pollId"],
    },
  },
  {
    name: "al0_get_results",
    description: "Get current vote tallies for a poll. Returns per-option vote counts and total.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pollId: { type: "integer", description: "Poll ID to read results for" },
      },
      required: ["pollId"],
    },
  },
  {
    name: "al0_list_polls",
    description: "List all governance polls, newest first. Optionally filter by swarm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarmId: { type: "string", description: "Optional swarm ID to filter polls" },
      },
    },
  },
  {
    name: "al0_get_agents",
    description: "List all registered AI agent swarms on the Algorand blockchain.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "al0_get_usage",
    description: "Get current API usage, quota, and plan details for this API key.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

export function createMcpServer(apiKey: string): Server {
  const client = new AL0Client({ apiKey });

  const server = new Server(
    { name: "agent-layer-0", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const a = args as Record<string, unknown>;

    try {
      switch (name) {
        case "al0_register_agent": {
          const result = await client.registerAgent({ swarmId: String(a["swarmId"]) });
          return ok({
            success: true,
            swarmId: result.swarmId,
            registryAppId: result.registryAppId.toString(),
            message: `Swarm "${result.swarmId}" registered. You can now call al0_create_poll.`,
          });
        }

        case "al0_create_poll": {
          const result = await client.createPoll({
            swarmId: String(a["swarmId"]),
            question: String(a["question"]),
            options: a["options"] as string[],
            expiresAt: Number(a["expiresAt"]),
          });
          return ok({
            success: true,
            pollId: Number(result.pollId),
            message: `Poll created with ID ${result.pollId}. Pass this pollId to al0_vote.`,
          });
        }

        case "al0_vote": {
          const result = await client.vote({
            pollId: Number(a["pollId"]),
            optionIndex: Number(a["optionIndex"]),
          });
          return ok({
            success: true,
            pollId: Number(result.pollId),
            optionIndex: result.optionIndex,
            message: `Vote cast on poll ${result.pollId} for option index ${result.optionIndex}.`,
          });
        }

        case "al0_get_poll": {
          return ok(await client.getPoll(Number(a["pollId"])));
        }

        case "al0_get_results": {
          const pollId = Number(a["pollId"]);
          const [results, poll] = await Promise.all([
            client.getResults(pollId),
            client.getPoll(pollId),
          ]);
          return ok({
            pollId: Number(results.pollId),
            question: poll.question,
            isActive: poll.isActive,
            totalVotes: Number(results.totalVotes),
            options: poll.options.map((label: string, i: number) => ({
              index: i,
              label,
              votes: Number(results.tallies[i] ?? 0n),
            })),
          });
        }

        case "al0_list_polls": {
          const swarmId = a["swarmId"] ? String(a["swarmId"]) : undefined;
          const path = `/api/relay/polls${swarmId ? `?swarm_id=${encodeURIComponent(swarmId)}` : ""}`;
          return ok(await apiFetch(path, apiKey));
        }

        case "al0_get_agents": {
          const appIds = await getAppIds(apiKey);
          const params = new URLSearchParams();
          if (appIds.agentRegistryAppId) {
            params.set("registry_app_id", String(appIds.agentRegistryAppId));
          }
          const qs = params.toString();
          return ok(await apiFetch(`/api/governance/agents${qs ? `?${qs}` : ""}`, apiKey));
        }

        case "al0_get_usage": {
          return ok(await apiFetch("/api/keys/me/usage", apiKey));
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err) {
      return fail(err);
    }
  });

  return server;
}

export async function startStdioServer(apiKey: string): Promise<void> {
  const server = createMcpServer(apiKey);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
