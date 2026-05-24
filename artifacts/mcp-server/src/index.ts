import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AL0_API_KEY = process.env["AL0_API_KEY"];
const AL0_API_URL = (process.env["AL0_API_URL"] ?? "https://agentlayer0.com").replace(/\/$/, "");

if (!AL0_API_KEY) {
  process.stderr.write(
    "[AL0 MCP] ERROR: AL0_API_KEY environment variable is required.\n" +
    "[AL0 MCP] Get your API key from the AL0 dashboard: https://agentlayer0.com/dashboard\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// AL0 API client
// ---------------------------------------------------------------------------

interface Al0Context {
  swarms: string[];
  appIds: {
    agentRegistryAppId: number | null;
    pollFactoryAppId: number | null;
    ballotBoxAppId: number | null;
  };
}

let cachedContext: Al0Context | null = null;

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${AL0_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AL0_API_KEY}`,
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as Record<string, unknown>)["error"] ?? res.statusText;
    throw new Error(`AL0 API error ${res.status}: ${msg}`);
  }

  return body as T;
}

async function getContext(): Promise<Al0Context> {
  if (cachedContext) return cachedContext;
  cachedContext = await apiFetch<Al0Context>("/api/keys/me/context");
  return cachedContext;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: "al0_register_swarm",
    description:
      "Register an AI agent swarm on the Algorand blockchain via the AL0 relay. " +
      "Must be called before the swarm can create polls or cast votes. " +
      "Returns the on-chain transaction ID and app ID.",
    inputSchema: {
      type: "object",
      properties: {
        swarm_id: {
          type: "string",
          description:
            "Unique identifier for this agent swarm (e.g. 'my-dao-agents'). " +
            "Must be alphanumeric with hyphens or underscores.",
        },
      },
      required: ["swarm_id"],
    },
  },
  {
    name: "al0_create_poll",
    description:
      "Create a governance poll on-chain for an agent swarm. " +
      "Agents can then cast votes on the poll options. " +
      "Returns the poll ID, which is needed for al0_cast_vote.",
    inputSchema: {
      type: "object",
      properties: {
        swarm_id: {
          type: "string",
          description: "The swarm ID that owns this poll.",
        },
        question: {
          type: "string",
          description: "The governance question to vote on (max 128 chars).",
        },
        options: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 8,
          description: "List of 2–8 answer options for the poll.",
        },
        expires_in_hours: {
          type: "number",
          description:
            "How many hours until the poll closes (default: 168 = 7 days). Min: 1. Max: 720.",
        },
      },
      required: ["swarm_id", "question", "options"],
    },
  },
  {
    name: "al0_cast_vote",
    description:
      "Cast a vote on an active governance poll. " +
      "Each API key can vote once per poll. " +
      "Votes are recorded on the Algorand blockchain and cannot be changed.",
    inputSchema: {
      type: "object",
      properties: {
        poll_id: {
          type: "number",
          description: "The numeric poll ID returned by al0_create_poll or al0_list_polls.",
        },
        option_index: {
          type: "number",
          description:
            "Zero-based index of the option to vote for. " +
            "Check al0_list_polls to see the options and their indices.",
        },
      },
      required: ["poll_id", "option_index"],
    },
  },
  {
    name: "al0_list_polls",
    description:
      "List governance polls for a swarm, including current vote tallies and status. " +
      "Use this to check which polls are active and what the current results look like.",
    inputSchema: {
      type: "object",
      properties: {
        swarm_id: {
          type: "string",
          description:
            "Filter polls by swarm ID. If omitted, returns polls for all your swarms.",
        },
        status: {
          type: "string",
          enum: ["active", "closed"],
          description:
            "Filter by poll status. 'active' = open for voting, 'closed' = voting ended. " +
            "Omit to return all polls.",
        },
      },
      required: [],
    },
  },
  {
    name: "al0_get_agents",
    description:
      "Get registered agent swarms and their on-chain participation stats. " +
      "Shows vote counts, last activity, and participation rates.",
    inputSchema: {
      type: "object",
      properties: {
        swarm_id: {
          type: "string",
          description: "Filter by a specific swarm ID. Omit to return all swarms.",
        },
      },
      required: [],
    },
  },
  {
    name: "al0_get_usage",
    description:
      "Check current API usage, quota remaining, and billing plan. " +
      "Use this to understand how many relay transactions you have left this period " +
      "and whether you have overage charges accruing (Scale plan only).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

const RegisterSwarmInput = z.object({ swarm_id: z.string().min(1) });
const CreatePollInput = z.object({
  swarm_id: z.string().min(1),
  question: z.string().min(1).max(128),
  options: z.array(z.string().min(1)).min(2).max(8),
  expires_in_hours: z.number().min(1).max(720).optional().default(168),
});
const CastVoteInput = z.object({
  poll_id: z.number().int().nonnegative(),
  option_index: z.number().int().nonnegative(),
});
const ListPollsInput = z.object({
  swarm_id: z.string().optional(),
  status: z.enum(["active", "closed"]).optional(),
});
const GetAgentsInput = z.object({
  swarm_id: z.string().optional(),
});

async function handleRegisterSwarm(raw: unknown): Promise<string> {
  const { swarm_id } = RegisterSwarmInput.parse(raw);
  const result = await apiFetch<Record<string, unknown>>("/api/relay/register", {
    method: "POST",
    body: JSON.stringify({ swarm_id }),
  });
  return (
    `✅ Swarm registered on-chain.\n\n` +
    `Swarm ID:   ${result["swarm_id"]}\n` +
    `App ID:     ${result["appId"]}\n` +
    `Tx ID:      ${result["txId"]}\n` +
    `AlgoExplorer: https://testnet.algoexplorer.io/tx/${result["txId"]}`
  );
}

async function handleCreatePoll(raw: unknown): Promise<string> {
  const { swarm_id, question, options, expires_in_hours } = CreatePollInput.parse(raw);
  const expires_at = Math.floor(Date.now() / 1000) + expires_in_hours * 3600;
  const result = await apiFetch<Record<string, unknown>>("/api/relay/poll", {
    method: "POST",
    body: JSON.stringify({ swarm_id, question, options, expires_at }),
  });
  const expiresDate = new Date(expires_at * 1000).toISOString();
  return (
    `✅ Poll created on-chain.\n\n` +
    `Poll ID:    ${result["pollId"]}\n` +
    `Question:   ${question}\n` +
    `Options:    ${options.map((o, i) => `[${i}] ${o}`).join(", ")}\n` +
    `Closes:     ${expiresDate}\n` +
    `Tx ID:      ${result["txId"]}\n\n` +
    `Use poll_id ${result["pollId"]} with al0_cast_vote to submit votes.`
  );
}

async function handleCastVote(raw: unknown): Promise<string> {
  const { poll_id, option_index } = CastVoteInput.parse(raw);
  const result = await apiFetch<Record<string, unknown>>("/api/relay/vote", {
    method: "POST",
    body: JSON.stringify({ poll_id, option_index }),
  });
  return (
    `✅ Vote recorded on-chain.\n\n` +
    `Poll ID:      ${result["poll_id"]}\n` +
    `Option voted: [${result["option_index"]}]\n` +
    `Swarm ID:     ${result["swarm_id"]}\n` +
    `Tx ID:        ${result["txId"]}\n\n` +
    `This vote is permanently recorded on Algorand and cannot be changed.`
  );
}

async function handleListPolls(raw: unknown): Promise<string> {
  const { swarm_id, status } = ListPollsInput.parse(raw);
  const ctx = await getContext();

  const pollFactoryId = ctx.appIds.pollFactoryAppId;
  const ballotBoxId = ctx.appIds.ballotBoxAppId;

  if (!pollFactoryId) {
    return "❌ No PollFactory app ID found. Check your AL0 account configuration.";
  }

  const params = new URLSearchParams();
  params.set("poll_factory_app_id", String(pollFactoryId));
  if (ballotBoxId) params.set("ballot_box_app_id", String(ballotBoxId));
  if (swarm_id) params.set("swarm_id", swarm_id);

  const result = await apiFetch<{ polls: Array<Record<string, unknown>>; total: number }>(
    `/api/governance/polls?${params}`,
  );

  const filtered = status
    ? result.polls.filter((p) => p["status"] === status)
    : result.polls;

  if (filtered.length === 0) {
    return `No ${status ?? ""} polls found${swarm_id ? ` for swarm "${swarm_id}"` : ""}.`;
  }

  const lines = filtered.map((p) => {
    const opts = (p["options"] as Array<{ text: string; votes: number }> | undefined) ?? [];
    const optStr = opts.map((o, i) => `    [${i}] ${o.text} — ${o.votes} votes`).join("\n");
    return (
      `📊 Poll #${p["poll_id"]} [${p["status"]}]\n` +
      `   Question:    ${p["question"]}\n` +
      `   Total votes: ${p["total_votes"]}\n` +
      `   Options:\n${optStr}\n` +
      `   Swarm:       ${p["swarm_id"]}\n` +
      `   Closes:      ${new Date((p["expires_at"] as number) * 1000).toISOString()}`
    );
  });

  return `Found ${filtered.length} poll(s):\n\n${lines.join("\n\n")}`;
}

async function handleGetAgents(raw: unknown): Promise<string> {
  const { swarm_id } = GetAgentsInput.parse(raw);
  const ctx = await getContext();

  const registryId = ctx.appIds.agentRegistryAppId;
  if (!registryId) {
    return "❌ No AgentRegistry app ID found. Check your AL0 account configuration.";
  }

  const params = new URLSearchParams();
  params.set("registry_app_id", String(registryId));
  if (ctx.appIds.ballotBoxAppId) params.set("ballot_box_app_id", String(ctx.appIds.ballotBoxAppId));
  if (ctx.appIds.pollFactoryAppId) params.set("poll_factory_app_id", String(ctx.appIds.pollFactoryAppId));
  if (swarm_id) params.set("swarm_id", swarm_id);

  const result = await apiFetch<{ agents: Array<Record<string, unknown>>; total: number }>(
    `/api/governance/agents?${params}`,
  );

  if (result.agents.length === 0) {
    return `No agents found${swarm_id ? ` for swarm "${swarm_id}"` : ""}.`;
  }

  const lines = result.agents.map((a) =>
    `🤖 ${a["swarm_id"]}\n` +
    `   Address:      ${a["address"]}\n` +
    `   Votes cast:   ${a["vote_count"]}\n` +
    `   Last active:  ${a["last_active"] ?? "Never"}\n` +
    `   Participation: ${a["participation_rate"] ?? "N/A"}`,
  );

  return `Found ${result.agents.length} agent(s):\n\n${lines.join("\n\n")}`;
}

async function handleGetUsage(): Promise<string> {
  const usage = await apiFetch<Record<string, unknown>>("/api/keys/me/usage");
  const plan = String(usage["plan"] ?? "free");
  const quota = Number(usage["quota"] ?? 0);
  const used = Number(usage["txCountThisPeriod"] ?? 0);
  const overage = Number(usage["overageVotes"] ?? 0);
  const remaining = Math.max(0, quota - used);
  const resetAt = usage["periodResetAt"]
    ? new Date(usage["periodResetAt"] as string).toISOString()
    : "Unknown";

  let output =
    `📈 AL0 API Usage\n\n` +
    `Plan:          ${plan.toUpperCase()}\n` +
    `Quota:         ${quota.toLocaleString()} votes/month\n` +
    `Used:          ${used.toLocaleString()}\n` +
    `Remaining:     ${remaining.toLocaleString()}\n` +
    `Period resets: ${resetAt}\n`;

  if (plan === "scale" && overage > 0) {
    const cost = (overage * 0.001).toFixed(2);
    output +=
      `\nOverage votes: ${overage.toLocaleString()} (est. $${cost} billed at renewal)\n` +
      `Overage rate:  $0.001/vote above ${quota.toLocaleString()}`;
  } else if (plan === "scale") {
    output += `\nOverage rate:  $0.001/vote above ${quota.toLocaleString()} (none accrued yet)`;
  }

  if (plan !== "scale" && remaining === 0) {
    output += `\n\n⚠️  Quota exhausted. Upgrade to continue submitting votes.`;
  }

  return output;
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "al0-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let text: string;

    switch (name) {
      case "al0_register_swarm":
        text = await handleRegisterSwarm(args);
        break;
      case "al0_create_poll":
        text = await handleCreatePoll(args);
        break;
      case "al0_cast_vote":
        text = await handleCastVote(args);
        break;
      case "al0_list_polls":
        text = await handleListPolls(args);
        break;
      case "al0_get_agents":
        text = await handleGetAgents(args);
        break;
      case "al0_get_usage":
        text = await handleGetUsage();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `❌ Error: ${message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[AL0 MCP] Server running — connected to ${AL0_API_URL}\n`);
