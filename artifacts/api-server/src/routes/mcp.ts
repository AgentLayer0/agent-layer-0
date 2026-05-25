import { Router, type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDeployedAppIds } from "@workspace/al0-contracts";

const router = Router();

const TOOLS = [
  {
    name: "al0_register_swarm",
    description:
      "Register a new AI agent swarm on the Algorand blockchain via Agent Layer 0. Creates an on-chain record tied to your API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarm_id: {
          type: "string",
          description: "Unique identifier for the swarm (max 64 chars, e.g. 'my-dao-agents')",
        },
      },
      required: ["swarm_id"],
    },
  },
  {
    name: "al0_create_poll",
    description:
      "Create an on-chain governance poll for an AI agent swarm. Returns the poll_id to use when casting votes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarm_id: { type: "string", description: "Swarm identifier (must be registered)" },
        question: { type: "string", description: "The governance question being asked" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Array of 2–8 vote options",
        },
        expires_at: {
          type: "number",
          description: "Unix timestamp (seconds) when the poll closes",
        },
      },
      required: ["swarm_id", "question", "options", "expires_at"],
    },
  },
  {
    name: "al0_cast_vote",
    description:
      "Cast a vote on an existing on-chain governance poll on behalf of the swarm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        poll_id: { type: "number", description: "The poll ID returned from al0_create_poll" },
        option_index: {
          type: "number",
          description: "Zero-based index of the chosen option",
        },
      },
      required: ["poll_id", "option_index"],
    },
  },
  {
    name: "al0_list_polls",
    description:
      "List all governance polls, optionally filtered by swarm. Includes live vote tallies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        swarm_id: {
          type: "string",
          description: "Optional swarm ID to filter polls",
        },
      },
    },
  },
  {
    name: "al0_get_agents",
    description: "List all registered AI agent swarms on the Algorand blockchain.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "al0_get_usage",
    description: "Get current API usage and quota for this API key.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

function getLocalBase(): string {
  const port = process.env["PORT"];
  if (!port) throw new Error("PORT env var not set");
  return `http://localhost:${port}`;
}

async function localGet(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${getLocalBase()}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const msg = (body as { error?: string }).error ?? res.statusText;
    throw new Error(msg);
  }
  return body;
}

async function localPost(path: string, data: unknown, apiKey: string): Promise<unknown> {
  const res = await fetch(`${getLocalBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const msg = (body as { error?: string }).error ?? res.statusText;
    throw new Error(msg);
  }
  return body;
}

function createMcpServer(apiKey: string): Server {
  const server = new Server(
    { name: "agent-layer-0", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let result: unknown;

      if (name === "al0_register_swarm") {
        result = await localPost("/api/relay/register", args, apiKey);
      } else if (name === "al0_create_poll") {
        const raw = await localPost("/api/relay/poll", args, apiKey) as Record<string, unknown>;
        // Normalize pollId (camelCase string) → poll_id (integer) so the LLM
        // can immediately use the value in a subsequent al0_cast_vote call.
        result = {
          ...raw,
          poll_id: typeof raw["pollId"] !== "undefined" ? Number(raw["pollId"]) : undefined,
        };
      } else if (name === "al0_cast_vote") {
        result = await localPost("/api/relay/vote", args, apiKey);
      } else if (name === "al0_list_polls") {
        const appIds = getDeployedAppIds();
        const params = new URLSearchParams({
          poll_factory_app_id: String(appIds.pollFactoryAppId ?? 0),
          ballot_box_app_id: String(appIds.ballotBoxAppId ?? 0),
        });
        const swarmId = (args as Record<string, string>)["swarm_id"];
        if (swarmId) params.set("swarm_id", swarmId);
        result = await localGet(`/api/governance/polls?${params}`, apiKey);
      } else if (name === "al0_get_agents") {
        const appIds = getDeployedAppIds();
        const params = new URLSearchParams({
          registry_app_id: String(appIds.agentRegistryAppId ?? 0),
        });
        result = await localGet(`/api/governance/agents?${params}`, apiKey);
      } else if (name === "al0_get_usage") {
        result = await localGet("/api/keys/me/usage", apiKey);
      } else {
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  });

  return server;
}

router.post("/mcp", async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const apiKey =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (!apiKey) {
    res.status(401).json({
      error: "Authorization header required: Bearer <al0_api_key>",
    });
    return;
  }

  const server = createMcpServer(apiKey);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as unknown);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP internal error" });
    }
  } finally {
    await server.close();
  }
});

router.get("/mcp", (_req: Request, res: Response): void => {
  res.status(405).json({
    error: "This MCP endpoint uses stateless HTTP transport. Connect via POST only.",
  });
});

export default router;
