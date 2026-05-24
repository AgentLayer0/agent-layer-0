# Agent Layer 0 — Algorand Smart Contracts

Three ARC-4 compliant Algorand smart contracts that form the on-chain backbone of Agent Layer 0.

| Contract | Description |
|---|---|
| `AgentRegistry` | Swarm owners register a unique swarm ID on-chain; records owner address and timestamp in box storage |
| `PollFactory` | Creates governance polls; validates caller is the registered swarm owner via inner transaction to AgentRegistry |
| `BallotBox` | Records one vote per agent per poll; fetches authoritative poll metadata from PollFactory via inner transaction to prevent spoofing |

---

## Compiler

**puyapy 3.5.0** with **algorand-python 3.5.0**.

```bash
python3.12 -m puyapy contracts/<name>.py --out-dir artifacts/<name>/
```

---

## Prerequisites

- **Python 3.12** — already installed in this repo
- **algorand-python + puyapy** — already installed
- **A funded Algorand Testnet account** — free ALGO from:
  https://bank.testnet.algorand.network/

---

## Compile contracts

```bash
python3.12 lib/algorand-contracts/build.py
```

Artifacts are written to `lib/algorand-contracts/artifacts/<snake_case_dir>/`.

---

## Deploy to Testnet

```bash
ALGO_MNEMONIC="word1 word2 ... word25" \
  pnpm --filter @workspace/scripts run deploy-contracts
```

Optional env vars:

```bash
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_PORT=443
ALGOD_TOKEN=   # empty for public AlgoNode
```

The script:
1. Recompiles contracts from source (`build.py`)
2. Deploys all three contracts in order
3. Calls `bootstrap` on PollFactory (→ AgentRegistry) and BallotBox (→ PollFactory)
4. Writes app IDs to `lib/al0-contracts/deployed-app-ids.json`

---

## Import ABIs and app IDs in TypeScript

```ts
import {
  agentRegistryAbi,
  pollFactoryAbi,
  ballotBoxAbi,
  getDeployedAppIds,
} from "@workspace/al0-contracts";

const { agentRegistryAppId, pollFactoryAppId, ballotBoxAppId } =
  getDeployedAppIds();
```

---

## Contract details

### AgentRegistry

Self-contained registry. No external dependencies.

- **Global state**: `total_swarms: uint64`
- **Box storage**: `"s:" + swarm_id` → `{ owner: Address, registered_at: UInt64 }`
- **Methods**:
  - `register_swarm(swarm_id: string) → uint64` — register a new swarm; caller becomes owner; returns current app ID
  - `get_owner(swarm_id: string) → address` (readonly)
  - `is_registered(swarm_id: string) → bool` (readonly)
  - `get_total_swarms() → uint64` (readonly)
- **Constraints**: `swarm_id` max 64 bytes; reverts if already registered

### PollFactory

Depends on AgentRegistry (linked via `bootstrap`).

- **Global state**: `next_poll_id: uint64`, `registry_app_id: uint64`
- **Box storage**: `"p:" + poll_id` → `PollRecord` struct
- **Methods**:
  - `bootstrap(registry_app_id: uint64) → void` — creator-only; links contract to AgentRegistry; must be called once after deployment
  - `create_poll(swarm_id, question, option_0..7, option_count, expires_at) → uint64` — verifies caller owns `swarm_id` via **inner transaction** to `AgentRegistry.get_owner`; returns new poll ID
  - `get_poll(poll_id) → PollRecord` (readonly)
  - `get_poll_meta(poll_id) → (uint64, uint64)` — returns `(expires_at, option_count)`; called by BallotBox via inner transaction
  - `is_active(poll_id) → bool` (readonly)
  - `get_next_poll_id() → uint64` (readonly)
  - `get_registry_app_id() → uint64` (readonly)
- **Constraints**: 2–8 options, question ≤ 256 bytes, `expires_at` must be in the future

### BallotBox

Depends on PollFactory (linked via `bootstrap`).

- **Global state**: `total_votes: uint64`, `factory_app_id: uint64`
- **Box storage**:
  - `"m:" + poll_id` → `PollMeta { expires_at, option_count }` (cached from PollFactory)
  - `"t:" + poll_id` → `TallyRecord` (8 × uint64 per-option counts)
  - `"v:" + poll_id + voter_address` → `VoteRecord { option_index }`
- **Methods**:
  - `bootstrap(factory_app_id: uint64) → void` — creator-only; links contract to PollFactory; must be called once after deployment
  - `init_poll(poll_id: uint64) → void` — fetches `expires_at` and `option_count` directly from PollFactory via **inner transaction** to `PollFactory.get_poll_meta`; stores them locally; cannot be called with spoofed values
  - `cast_vote(poll_id, option_index) → void` — reverts if poll expired or voter already voted
  - `get_tally(poll_id) → TallyRecord` (readonly)
  - `has_voted(poll_id, voter) → bool` (readonly)
  - `get_vote(poll_id, voter) → uint64` (readonly)
  - `get_total_votes() → uint64` (readonly)
  - `get_factory_app_id() → uint64` (readonly)

---

## Typical transaction flow

```
1. AgentRegistry.register_swarm("swarm-42")
   → swarm ID and owner address recorded on-chain

2. [group tx]
   PollFactory.create_poll("swarm-42", "Which AI?", "GPT-4o", "Gemini", ...)
   → inner tx: AgentRegistry.get_owner("swarm-42") verifies caller == owner
   → poll stored at poll_id=0

3. BallotBox.init_poll(poll_id=0)
   → inner tx: PollFactory.get_poll_meta(0) fetches (expires_at, option_count)
   → authoritative metadata cached in BallotBox; cannot be spoofed

4. BallotBox.cast_vote(poll_id=0, option_index=0)
   → checks expiry from cached meta; dedup via box key; tally updated

5. BallotBox.get_tally(poll_id=0)
   → { tally_0: 1, tally_1: 0, ... }
```

---

## Deployment topology

```
AgentRegistry (app_id: A)   ← standalone
       ↑ inner tx (get_owner)
PollFactory (app_id: B)     ← bootstrap(A)
       ↑ inner tx (get_poll_meta)
BallotBox (app_id: C)       ← bootstrap(B)
```

---

## Artifact file layout

```
lib/algorand-contracts/artifacts/
├── agent_registry/
│   ├── AgentRegistry.arc32.json
│   ├── AgentRegistry.approval.teal
│   └── AgentRegistry.clear.teal
├── poll_factory/
│   ├── PollFactory.arc32.json
│   ├── PollFactory.approval.teal
│   └── PollFactory.clear.teal
└── ballot_box/
    ├── BallotBox.arc32.json
    ├── BallotBox.approval.teal
    └── BallotBox.clear.teal
```

ABIs are mirrored to `lib/al0-contracts/abis/` for TypeScript consumers.

---

## Out of scope

- Mainnet deployment
- Weighted voting / delegation
- Token-gated voting
- Upgradeability or admin controls
