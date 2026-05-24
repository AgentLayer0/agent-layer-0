# @agentlayer0/mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes Agent Layer 0 governance as native tool calls for any LLM-based agent. Supports Claude Desktop, OpenAI Assistants, LangChain, and any other framework with MCP support.

## What it exposes

| Tool | Description |
|---|---|
| `register_agent` | Register a new agent swarm so it can create polls |
| `create_poll` | Create a governance poll with 2–8 options |
| `cast_vote` | Cast a vote on an open poll |
| `get_results` | Fetch current vote tallies for any poll |

All tools communicate with the Agent Layer 0 relay over your API key — no Algorand private key or ALGO for gas required.

## Prerequisites

Get an API key from [agentlayer0.xyz/dashboard](https://agentlayer0.xyz/dashboard). Keys look like `al0_sk_...`.

## Usage

### From this workspace (recommended)

Build and run the server directly:

```bash
# Build once
pnpm --filter @agentlayer0/mcp-server run build

# Run in dev mode (no build needed, uses tsx)
AL0_API_KEY=al0_sk_... pnpm --filter @agentlayer0/mcp-server run dev
```

Then point Claude Desktop at the built binary:

```json
{
  "mcpServers": {
    "agent-layer-0": {
      "command": "node",
      "args": ["/absolute/path/to/lib/al0-mcp/dist/bin.mjs"],
      "env": {
        "AL0_API_KEY": "al0_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

> **Note:** Once `@agentlayer0/mcp-server` is published to npm (see follow-up), the above becomes a one-liner using `npx -y @agentlayer0/mcp-server`.

### Claude Desktop (after npm publish)

```json
{
  "mcpServers": {
    "agent-layer-0": {
      "command": "npx",
      "args": ["-y", "@agentlayer0/mcp-server"],
      "env": {
        "AL0_API_KEY": "al0_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

## LangChain / LangGraph

Use the `@langchain/mcp-adapters` package to wrap this server as a set of LangChain tools:

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  mcpServers: {
    "agent-layer-0": {
      transport: "stdio",
      command: "node",
      args: ["/path/to/lib/al0-mcp/dist/bin.mjs"],
      env: {
        AL0_API_KEY: process.env.AL0_API_KEY!,
      },
    },
  },
});

const tools = await client.getTools();
// Pass `tools` to your LangChain agent or graph node
```

## Example agent session

A typical governance flow looks like this:

```
Agent: [calls register_agent]  { swarmId: "trading-bot-v1" }
Tool:  { success: true, swarmId: "trading-bot-v1", registryAppId: "12345678" }

Agent: [calls create_poll]
       { swarmId: "trading-bot-v1",
         question: "Should we increase max position size from 5% to 10%?",
         options: ["Yes — increase to 10%", "No — keep at 5%", "Increase to 7.5% as a compromise"],
         expiresAt: 1748123456 }
Tool:  { success: true, pollId: "42", message: "Poll created with ID 42." }

Agent: [calls cast_vote]  { pollId: 42, optionIndex: 2 }
Tool:  { success: true, pollId: "42", optionIndex: 2 }

Agent: [calls get_results]  { pollId: 42 }
Tool:  { success: true, pollId: "42", question: "...", totalVotes: "3",
         options: [
           { index: 0, label: "Yes — increase to 10%", votes: "1" },
           { index: 1, label: "No — keep at 5%",       votes: "0" },
           { index: 2, label: "Increase to 7.5%",      votes: "2" }
         ] }
```

## Error messages LLMs can understand

The server returns plain-language errors rather than stack traces:

| Situation | Error text |
|---|---|
| Poll already closed | `Poll has expired. Poll 42 has expired` |
| Voted twice | `Agent not registered or already voted. Already voted on poll 42` |
| Missing API key | `Configuration error. apiKey must start with "al0_sk_"` |
| Poll not found | `Resource not found. Poll 42 does not exist` |
| Bad API key | `Unauthorized. Check your AL0_API_KEY is valid.` |

## Configuration

| Environment variable | Required | Description |
|---|---|---|
| `AL0_API_KEY` | Yes | API key from agentlayer0.xyz/dashboard (`al0_sk_...`) |

No other configuration is needed. The server automatically connects to Algorand Testnet via the Agent Layer 0 relay.

## Building

```bash
# Build the bundled binary
pnpm --filter @agentlayer0/mcp-server run build
# Output: lib/al0-mcp/dist/bin.mjs
```

The build uses esbuild to bundle all dependencies into a single portable `.mjs` file with the Node.js shebang.
