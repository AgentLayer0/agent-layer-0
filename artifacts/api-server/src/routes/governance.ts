import { Router, type IRouter } from "express";
import algosdk from "algosdk";
import { parsePollBoxBytes } from "@workspace/al0-contracts";

const router: IRouter = Router();

const NETWORK = process.env["ALGORAND_NETWORK"] ?? "testnet";
const INDEXER_BASE = `https://${NETWORK}-idx.algonode.cloud/v2`;

const TALLY_TYPE = algosdk.ABIType.from(
  "(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)"
);

interface IndexerBox {
  name: string;
}

async function fetchAllBoxes(appId: number): Promise<IndexerBox[]> {
  const boxes: IndexerBox[] = [];
  let nextToken: string | undefined;
  do {
    const url = new URL(`${INDEXER_BASE}/applications/${appId}/boxes`);
    url.searchParams.set("limit", "1000");
    if (nextToken) url.searchParams.set("next", nextToken);
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Indexer error ${res.status} fetching boxes for app ${appId}`);
    }
    const data = (await res.json()) as {
      boxes?: IndexerBox[];
      "next-token"?: string;
    };
    boxes.push(...(data.boxes ?? []));
    nextToken = data["next-token"];
  } while (nextToken);
  return boxes;
}

async function fetchBoxValue(appId: number, boxNameB64: string): Promise<string | null> {
  const encoded = encodeURIComponent(`b64:${boxNameB64}`);
  const res = await fetch(`${INDEXER_BASE}/applications/${appId}/box?name=${encoded}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: string };
  return data.value ?? null;
}

async function fetchAppTransactionSenders(appId: number): Promise<Map<string, number>> {
  const senderLastActive = new Map<string, number>();
  const res = await fetch(
    `${INDEXER_BASE}/applications/${appId}/transactions?limit=500`
  );
  if (!res.ok) return senderLastActive;
  const data = (await res.json()) as {
    transactions?: Array<{ sender: string; "round-time": number }>;
  };
  for (const tx of data.transactions ?? []) {
    const existing = senderLastActive.get(tx.sender) ?? 0;
    if ((tx["round-time"] ?? 0) > existing) {
      senderLastActive.set(tx.sender, tx["round-time"]);
    }
  }
  return senderLastActive;
}

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function hasPollPrefix(buf: Buffer): boolean {
  return buf.length === 10 && buf[0] === 0x70 && buf[1] === 0x3a;
}

function hasTallyPrefix(buf: Buffer): boolean {
  return buf.length === 10 && buf[0] === 0x74 && buf[1] === 0x3a;
}

function isVoteBox(buf: Buffer): boolean {
  return buf.length === 42 && buf[0] === 0x76 && buf[1] === 0x3a;
}

function decodePollIdFromName(buf: Buffer): bigint {
  return buf.readBigUInt64BE(2);
}

function decodeTallyIdFromName(buf: Buffer): bigint {
  return buf.readBigUInt64BE(2);
}

function parseVoteBoxName(buf: Buffer): { pollId: bigint; voterPubkey: Uint8Array } {
  const pollId = buf.readBigUInt64BE(2);
  const voterPubkey = new Uint8Array(buf.buffer, buf.byteOffset + 10, 32);
  return { pollId, voterPubkey };
}

function decodePollRecord(valueB64: string) {
  const bytes = b64ToBuffer(valueB64);
  const r = parsePollBoxBytes(bytes);
  const optionCount = Number(r.option_count);
  const allOptions = [r.option_0, r.option_1, r.option_2, r.option_3, r.option_4, r.option_5, r.option_6, r.option_7];
  const options = allOptions.slice(0, optionCount);
  return {
    creator: r.creator,
    swarm_id: r.swarm_id,
    question: r.question,
    option_count: optionCount,
    options,
    created_at: Number(r.created_at),
    expires_at: Number(r.expires_at),
  };
}

function decodeTallyRecord(valueB64: string, optionCount: number): number[] {
  const bytes = b64ToBuffer(valueB64);
  const decoded = TALLY_TYPE.decode(bytes) as bigint[];
  return decoded.slice(0, optionCount).map(Number);
}

/**
 * GET /api/governance/polls
 * Query params:
 *   poll_factory_app_id (required)
 *   ballot_box_app_id   (optional — provides vote tallies per option)
 *   swarm_id            (optional — filters polls to this swarm only)
 */
router.get("/governance/polls", async (req, res): Promise<void> => {
  const pollFactoryAppId = parseInt(
    String(req.query["poll_factory_app_id"] ?? process.env["POLL_FACTORY_APP_ID"] ?? ""),
    10,
  );
  const ballotBoxAppId = parseInt(
    String(req.query["ballot_box_app_id"] ?? process.env["BALLOT_BOX_APP_ID"] ?? ""),
    10,
  );
  const swarmIdFilter = String(req.query["swarm_id"] ?? "").trim();

  if (isNaN(pollFactoryAppId) || pollFactoryAppId <= 0) {
    res.status(400).json({
      error: "poll_factory_app_id is required and must be a positive integer",
    });
    return;
  }

  try {
    const allBoxes = await fetchAllBoxes(pollFactoryAppId);
    const pollBoxes = allBoxes.filter((b) => hasPollPrefix(b64ToBuffer(b.name)));

    const tallyMap = new Map<bigint, string>();
    if (!isNaN(ballotBoxAppId) && ballotBoxAppId > 0) {
      try {
        const tallyBoxes = await fetchAllBoxes(ballotBoxAppId);
        const tallyOnly = tallyBoxes.filter((b) => hasTallyPrefix(b64ToBuffer(b.name)));
        for (const box of tallyOnly) {
          const nameBuf = b64ToBuffer(box.name);
          const pollId = decodeTallyIdFromName(nameBuf);
          const value = await fetchBoxValue(ballotBoxAppId, box.name);
          if (value) tallyMap.set(pollId, value);
        }
      } catch {
        req.log.warn("Failed to fetch ballot box tallies; continuing without vote counts");
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const polls = [];

    for (const box of pollBoxes) {
      try {
        const nameBuf = b64ToBuffer(box.name);
        const pollId = decodePollIdFromName(nameBuf);
        const valueB64 = await fetchBoxValue(pollFactoryAppId, box.name);
        if (!valueB64) continue;

        const poll = decodePollRecord(valueB64);

        if (swarmIdFilter && poll.swarm_id !== swarmIdFilter) continue;

        const tallyB64 = tallyMap.get(pollId);
        const votes = tallyB64 ? decodeTallyRecord(tallyB64, poll.option_count) : null;

        polls.push({
          poll_id: Number(pollId),
          creator: poll.creator,
          swarm_id: poll.swarm_id,
          question: poll.question,
          options: poll.options.map((text, i) => ({
            text,
            votes: votes ? (votes[i] ?? 0) : null,
          })),
          total_votes: votes ? votes.reduce((a, b) => a + b, 0) : null,
          status: poll.expires_at > now ? "active" : "closed",
          expires_at: poll.expires_at,
          created_at: poll.created_at,
        });
      } catch (err) {
        req.log.warn({ err, box: box.name }, "Failed to decode poll box — skipping");
      }
    }

    polls.sort((a, b) => b.poll_id - a.poll_id);
    res.json({ polls, total: polls.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch governance polls");
    res.status(502).json({ error: "Failed to fetch polls from Algorand Indexer" });
  }
});

function hasRegistryPrefix(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x73 && buf[1] === 0x3a;
}

function decodeRegistryBoxName(buf: Buffer): string {
  const strLen = buf.readUInt16BE(2);
  return buf.slice(4, 4 + strLen).toString("utf8");
}

function decodeRegistryBoxValue(buf: Buffer): { address: string; registeredAt: number } {
  const pubkey = new Uint8Array(buf.buffer, buf.byteOffset, 32);
  const address = algosdk.encodeAddress(pubkey);
  const registeredAt = Number(buf.readBigUInt64BE(32));
  return { address, registeredAt };
}

/**
 * GET /api/governance/agents
 * Query params:
 *   registry_app_id     (required — AgentRegistry, source of registered swarm roster)
 *   ballot_box_app_id   (optional — cross-reference vote activity per agent)
 *   poll_factory_app_id (optional — total poll count for participation rate %)
 *   swarm_id            (optional — filter to a single swarm)
 *
 * Returns ALL registered agents (including those with zero votes), each with:
 *   swarm_id            Registered swarm identifier
 *   address             Owner's Algorand address
 *   registered_at       Unix timestamp of registration
 *   vote_count          Polls voted on (0 if ballot_box not provided or no votes)
 *   last_active         Unix ts of most recent BallotBox tx, or null
 *   participation_rate  Percent of total polls voted (0–100), or null
 */
router.get("/governance/agents", async (req, res): Promise<void> => {
  const registryAppId = parseInt(
    String(req.query["registry_app_id"] ?? process.env["AGENT_REGISTRY_APP_ID"] ?? ""),
    10,
  );
  const ballotBoxAppId = parseInt(
    String(req.query["ballot_box_app_id"] ?? process.env["BALLOT_BOX_APP_ID"] ?? ""),
    10,
  );
  const pollFactoryAppId = parseInt(
    String(req.query["poll_factory_app_id"] ?? process.env["POLL_FACTORY_APP_ID"] ?? ""),
    10,
  );
  const swarmIdFilter = String(req.query["swarm_id"] ?? "").trim();

  if (isNaN(registryAppId) || registryAppId <= 0) {
    res.status(400).json({
      error: "registry_app_id is required and must be a positive integer",
    });
    return;
  }

  try {
    // 1. Fetch registered agent roster from AgentRegistry
    const registryBoxes = await fetchAllBoxes(registryAppId);
    const agentBoxes = registryBoxes.filter((b) => hasRegistryPrefix(b64ToBuffer(b.name)));

    interface RegisteredAgent {
      swarm_id: string;
      address: string;
      registered_at: number;
    }
    const roster: RegisteredAgent[] = [];
    for (const box of agentBoxes) {
      try {
        const nameBuf = b64ToBuffer(box.name);
        const swarmId = decodeRegistryBoxName(nameBuf);
        if (swarmIdFilter && swarmId !== swarmIdFilter) continue;
        const valueB64 = await fetchBoxValue(registryAppId, box.name);
        if (!valueB64) continue;
        const valueBuf = b64ToBuffer(valueB64);
        if (valueBuf.length < 40) continue;
        const { address, registeredAt } = decodeRegistryBoxValue(valueBuf);
        roster.push({ swarm_id: swarmId, address, registered_at: registeredAt });
      } catch (err) {
        req.log.warn({ err, box: box.name }, "Failed to decode registry box — skipping");
      }
    }

    // 2. Optionally cross-reference BallotBox vote activity
    const voterMap = new Map<string, Set<bigint>>();
    let senderLastActive = new Map<string, number>();
    let totalPolls = 0;

    if (!isNaN(ballotBoxAppId) && ballotBoxAppId > 0) {
      try {
        const allBoxes = await fetchAllBoxes(ballotBoxAppId);
        const voteBoxes = allBoxes.filter((b) => isVoteBox(b64ToBuffer(b.name)));
        for (const box of voteBoxes) {
          const nameBuf = b64ToBuffer(box.name);
          const { pollId, voterPubkey } = parseVoteBoxName(nameBuf);
          try {
            const address = algosdk.encodeAddress(voterPubkey);
            if (!voterMap.has(address)) voterMap.set(address, new Set());
            voterMap.get(address)!.add(pollId);
          } catch { /* skip */ }
        }
        senderLastActive = await fetchAppTransactionSenders(ballotBoxAppId);
      } catch {
        req.log.warn("Failed to fetch BallotBox vote data; returning roster without activity");
      }
    }

    if (!isNaN(pollFactoryAppId) && pollFactoryAppId > 0) {
      try {
        const pollBoxes = (await fetchAllBoxes(pollFactoryAppId)).filter((b) =>
          hasPollPrefix(b64ToBuffer(b.name))
        );
        totalPolls = pollBoxes.length;
      } catch {
        req.log.warn("Failed to count total polls for participation rate");
      }
    }

    // 3. Merge roster with activity
    const agents = roster.map((r) => {
      const pollIds = voterMap.get(r.address);
      const voteCount = pollIds?.size ?? 0;
      const lastActive = senderLastActive.get(r.address) ?? null;
      const participationRate =
        totalPolls > 0 ? Math.round((voteCount / totalPolls) * 100) : null;
      return {
        swarm_id: r.swarm_id,
        address: r.address,
        registered_at: r.registered_at,
        vote_count: voteCount,
        last_active: lastActive,
        participation_rate: participationRate,
      };
    });

    agents.sort((a, b) => (b.last_active ?? 0) - (a.last_active ?? 0));
    res.json({ agents, total: agents.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch governance agents");
    res.status(502).json({ error: "Failed to fetch agents from Algorand Indexer" });
  }
});

export default router;
