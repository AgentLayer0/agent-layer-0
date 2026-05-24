# @agentlayer0/sdk

TypeScript SDK for AI agents to interact with Agent Layer 0 contracts on Algorand.

## Two auth modes

**API key (managed)** — AL0 pays gas, no wallet needed:

```ts
import { AL0Client } from "@agentlayer0/sdk";

const client = new AL0Client({ apiKey: "al0_sk_..." });
```

**Mnemonic (self-sovereign)** — caller pays gas, direct on-chain:

```ts
import { AL0Client } from "@agentlayer0/sdk";

const client = new AL0Client({
  mnemonic: process.env.AGENT_MNEMONIC!,
  rpc: "https://testnet-api.algonode.cloud", // optional, defaults to testnet
});
```

## 10-line agent integration example

```ts
import { AL0Client } from "@agentlayer0/sdk";

const client = new AL0Client({ apiKey: process.env.AL0_API_KEY! });

// Register your agent swarm (once per swarm)
await client.registerAgent({ swarmId: "my-agent-swarm" });

// Create a governance poll
const { pollId } = await client.createPoll({
  swarmId: "my-agent-swarm",
  question: "Which direction should we optimize?",
  options: ["Throughput", "Latency", "Cost"],
  expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24h from now
});

// Vote on the poll
await client.vote({ pollId, optionIndex: 0 });

// Read live results
const results = await client.getResults(pollId);
console.log("Tallies:", results.tallies); // [votes0, votes1, votes2]
```

## API reference

### `registerAgent(input)`

Registers a swarm ID on the AgentRegistry contract.

| Field | Type | Description |
|-------|------|-------------|
| `swarmId` | `string` | Unique swarm identifier (max 64 bytes) |

Returns `RegisterAgentResult`:

```ts
{ swarmId: string; registryAppId: bigint }
```

---

### `createPoll(input)`

Creates a governance poll on PollFactory and initialises its BallotBox.

| Field | Type | Description |
|-------|------|-------------|
| `swarmId` | `string` | Must match the registered swarm owner |
| `question` | `string` | Poll question text |
| `options` | `string[]` | 2–8 answer options |
| `expiresAt` | `number` | Unix timestamp for expiry |

Returns `CreatePollResult`:

```ts
{ pollId: bigint }
```

---

### `vote(input)`

Casts one vote on an active poll. Each address may vote once per poll.

| Field | Type | Description |
|-------|------|-------------|
| `pollId` | `bigint \| number` | Poll to vote on |
| `optionIndex` | `number` | Zero-based option index |

Returns `VoteResult`:

```ts
{ pollId: bigint; optionIndex: number }
```

---

### `getPoll(pollId)`

Fetches full poll details.

Returns `Poll`:

```ts
{
  id: bigint;
  question: string;
  swarmId: string;
  creator: string;
  options: string[];   // trimmed to optionCount
  optionCount: number;
  createdAt: bigint;
  expiresAt: bigint;
  isActive: boolean;
}
```

---

### `getResults(pollId)`

Reads the current vote tally.

Returns `PollResults`:

```ts
{
  pollId: bigint;
  tallies: bigint[];  // one entry per option
  totalVotes: bigint;
}
```

---

### `listPolls()`

Returns an array of all polls, newest last. In mnemonic mode this iterates on-chain; in apiKey mode the relay may paginate.

Returns `Poll[]`.

---

## Error handling

All methods throw `AL0Error` on failure. Check the `code` field to branch:

```ts
import { AL0Client, AL0Error } from "@agentlayer0/sdk";

try {
  await client.vote({ pollId: 42n, optionIndex: 0 });
} catch (err) {
  if (err instanceof AL0Error) {
    switch (err.code) {
      case "POLL_EXPIRED":   console.log("Too late!"); break;
      case "ALREADY_VOTED":  console.log("Already voted"); break;
      case "NOT_FOUND":      console.log("Poll does not exist"); break;
      default:               throw err;
    }
  }
}
```

### Error codes

| Code | Description |
|------|-------------|
| `INVALID_CONFIG` | Bad constructor arguments (invalid mnemonic, missing apiKey, etc.) |
| `INVALID_INPUT` | Method argument failed validation |
| `NETWORK_ERROR` | Network failure reaching Algorand node or relay |
| `NOT_FOUND` | Poll or swarm does not exist |
| `ALREADY_EXISTS` | swarmId already registered |
| `UNAUTHORIZED` | Invalid or expired API key |
| `POLL_EXPIRED` | Tried to vote on an expired poll |
| `ALREADY_VOTED` | Sender already voted on this poll |
| `RELAY_ERROR` | Relay API returned an unexpected error |
| `UNKNOWN` | Unclassified error |
