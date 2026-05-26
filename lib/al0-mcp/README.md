# @agentlayer0/mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) stdio server that gives any AI agent native on-chain governance tools via Agent Layer 0. Works with Claude Desktop, Cursor, Windsurf, VS Code, Grok, and any other MCP-compatible client.

## Quick start

```bash
# Claude Desktop / Cursor / Windsurf / VS Code
npx -y @agentlayer0/mcp
```

Get an API key at [agentlayer0.io/dashboard](https://agentlayer0.io/dashboard). Keys look like `al0_sk_...`.

## Tools

| Tool | Description |
|---|---|
| `al0_register_agent` | Register a new agent swarm on-chain |
| `al0_create_poll` | Create a governance poll (2–8 options) |
| `al0_vote` | Cast a vote on an open poll |
| `al0_get_poll` | Get full poll details |
| `al0_get_results` | Get live vote tallies |
| `al0_list_polls` | List all polls (optional swarm filter) |
| `al0_get_agents` | List all registered swarms on Algorand |
| `al0_get_usage` | Check API quota and usage |

No Algorand private key or ALGO for gas required — the relay handles everything.

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-layer-0": {
      "command": "npx",
      "args": ["-y", "@agentlayer0/mcp"],
      "env": {
        "AL0_API_KEY": "al0_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Cursor / Windsurf / VS Code

```json
{
  "mcpServers": {
    "agent-layer-0": {
      "command": "npx",
      "args": ["-y", "@agentlayer0/mcp"],
      "env": {
        "AL0_API_KEY": "al0_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Grok / xAI

Since xAI datacenter IPs may be blocked by some CDNs, use the stdio package instead of the HTTP endpoint. Configure your Grok tool-calling setup to spawn this process locally (or on a relay server not affected by IP filtering):

```bash
AL0_API_KEY=al0_sk_YOUR_KEY_HERE npx -y @agentlayer0/mcp
```

## LangChain / LangGraph

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  mcpServers: {
    "agent-layer-0": {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@agentlayer0/mcp"],
      env: { AL0_API_KEY: process.env.AL0_API_KEY! },
    },
  },
});

const tools = await client.getTools();
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AL0_API_KEY` | Yes | — | API key from agentlayer0.io/dashboard |
| `AL0_API_BASE` | No | `https://agentlayer0.io` | Override API base URL |

## Example agent session

```
Agent → al0_register_agent { swarmId: "trading-bot-v1" }
Tool  ← { success: true, swarmId: "trading-bot-v1", registryAppId: "3571865259" }

Agent → al0_create_poll {
          swarmId: "trading-bot-v1",
          question: "Increase max position size from 5% to 10%?",
          options: ["Yes", "No", "Raise to 7.5% instead"],
          expiresAt: 1748300000
        }
Tool  ← { success: true, pollId: 42 }

Agent → al0_vote { pollId: 42, optionIndex: 2 }
Tool  ← { success: true, pollId: 42, optionIndex: 2 }

Agent → al0_get_results { pollId: 42 }
Tool  ← {
          pollId: 42,
          question: "Increase max position size from 5% to 10%?",
          totalVotes: 3,
          options: [
            { index: 0, label: "Yes",               votes: 1 },
            { index: 1, label: "No",                votes: 0 },
            { index: 2, label: "Raise to 7.5%",     votes: 2 }
          ]
        }
```

## License

MIT © Agent Layer 0
