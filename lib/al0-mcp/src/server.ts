import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AL0Client, AL0Error } from "@agentlayer0/sdk";

const TOOL_REGISTER_AGENT = "register_agent";
const TOOL_CREATE_POLL = "create_poll";
const TOOL_CAST_VOTE = "cast_vote";
const TOOL_GET_RESULTS = "get_results";

function formatError(err: unknown): string {
  if (err instanceof AL0Error) {
    switch (err.code) {
      case "POLL_EXPIRED":
        return `Poll has expired. ${err.message}`;
      case "ALREADY_VOTED":
        return `Agent not registered or already voted. ${err.message}`;
      case "ALREADY_EXISTS":
        return `Agent not registered or resource already exists. ${err.message}`;
      case "NOT_FOUND":
        return `Resource not found. ${err.message}`;
      case "UNAUTHORIZED":
        return `Unauthorized. Check your AL0_API_KEY is valid. ${err.message}`;
      case "INVALID_INPUT":
        return `Invalid input. ${err.message}`;
      case "INVALID_CONFIG":
        return `Configuration error. ${err.message}`;
      case "RELAY_ERROR":
        return `Relay error. ${err.message}`;
      case "NETWORK_ERROR":
        return `Network error. ${err.message}`;
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err ?? "Unknown error");
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function createMcpServer(apiKey: string): Server {
  const client = new AL0Client({ apiKey });

  const server = new Server(
    { name: "agent-layer-0", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_REGISTER_AGENT,
        description:
          "Register a new agent swarm with Agent Layer 0 so it can create polls and participate in governance. Must be called before create_poll.",
        inputSchema: {
          type: "object" as const,
          properties: {
            swarmId: {
              type: "string",
              description:
                "Unique identifier for this agent swarm (1–64 characters). Choose a descriptive name, e.g. 'trading-bot-v1' or 'data-pipeline-team'.",
            },
          },
          required: ["swarmId"],
        },
      },
      {
        name: TOOL_CREATE_POLL,
        description:
          "Create a governance poll for an agent swarm. Returns a pollId that other agents use to cast votes. The swarm must be registered first via register_agent.",
        inputSchema: {
          type: "object" as const,
          properties: {
            swarmId: {
              type: "string",
              description:
                "The swarm identifier that was registered via register_agent.",
            },
            question: {
              type: "string",
              description:
                "The question to put to a vote, e.g. 'Should we increase position size from 5% to 10%?'",
            },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 8,
              description:
                "The list of voting options (2–8 entries), e.g. ['Yes', 'No'] or ['Low', 'Medium', 'High'].",
            },
            expiresAt: {
              type: "number",
              description:
                "Unix timestamp (seconds) when this poll expires. Use a future timestamp, e.g. Date.now()/1000 + 3600 for one hour from now.",
            },
          },
          required: ["swarmId", "question", "options", "expiresAt"],
        },
      },
      {
        name: TOOL_CAST_VOTE,
        description:
          "Cast a vote on an existing poll. Each API key can only vote once per poll. Returns an error if the poll has expired or the vote was already cast.",
        inputSchema: {
          type: "object" as const,
          properties: {
            pollId: {
              type: "number",
              description:
                "The numeric poll ID returned by create_poll or visible on Lora (lora.algokit.io).",
            },
            optionIndex: {
              type: "number",
              description:
                "Zero-based index of the option to vote for. If options are ['Yes', 'No'], pass 0 for 'Yes' and 1 for 'No'.",
            },
          },
          required: ["pollId", "optionIndex"],
        },
      },
      {
        name: TOOL_GET_RESULTS,
        description:
          "Fetch the current vote tallies for a poll. Returns total votes and per-option counts. Can be called before or after the poll expires.",
        inputSchema: {
          type: "object" as const,
          properties: {
            pollId: {
              type: "number",
              description:
                "The numeric poll ID returned by create_poll or visible on Lora (lora.algokit.io).",
            },
          },
          required: ["pollId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case TOOL_REGISTER_AGENT: {
          const { swarmId } = args as { swarmId: string };
          const result = await client.registerAgent({ swarmId });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    swarmId: result.swarmId,
                    registryAppId: result.registryAppId.toString(),
                    message: `Agent swarm "${result.swarmId}" registered successfully. You can now call create_poll with this swarmId.`,
                  },
                  bigintReplacer
                ),
              },
            ],
          };
        }

        case TOOL_CREATE_POLL: {
          const { swarmId, question, options, expiresAt } = args as {
            swarmId: string;
            question: string;
            options: string[];
            expiresAt: number;
          };
          const result = await client.createPoll({
            swarmId,
            question,
            options,
            expiresAt,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    pollId: result.pollId.toString(),
                    message: `Poll created with ID ${result.pollId}. Share this pollId with agents that should vote. View on Lora: https://lora.algokit.io/${process.env["ALGORAND_NETWORK"] ?? "mainnet"}/`,
                  },
                  bigintReplacer
                ),
              },
            ],
          };
        }

        case TOOL_CAST_VOTE: {
          const { pollId, optionIndex } = args as {
            pollId: number;
            optionIndex: number;
          };
          const result = await client.vote({ pollId, optionIndex });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    pollId: result.pollId.toString(),
                    optionIndex: result.optionIndex,
                    message: `Vote cast successfully on poll ${result.pollId} for option index ${result.optionIndex}.`,
                  },
                  bigintReplacer
                ),
              },
            ],
          };
        }

        case TOOL_GET_RESULTS: {
          const { pollId } = args as { pollId: number };
          const results = await client.getResults(pollId);
          const poll = await client.getPoll(pollId);
          const breakdown = poll.options.map((label: string, i: number) => ({
            index: i,
            label,
            votes: (results.tallies[i] ?? 0n).toString(),
          }));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    pollId: results.pollId.toString(),
                    question: poll.question,
                    totalVotes: results.totalVotes.toString(),
                    isActive: poll.isActive,
                    options: breakdown,
                  },
                  bigintReplacer
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown tool: ${name}. Available tools: ${TOOL_REGISTER_AGENT}, ${TOOL_CREATE_POLL}, ${TOOL_CAST_VOTE}, ${TOOL_GET_RESULTS}`,
              },
            ],
            isError: true,
          };
      }
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: formatError(err),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdioServer(apiKey: string): Promise<void> {
  const server = createMcpServer(apiKey);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
