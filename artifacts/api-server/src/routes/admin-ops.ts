import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, waitlistTable, swarmWallets } from "@workspace/db/schema";
import { count, isNull } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-auth";
import { getRecentLogs } from "../lib/log-buffer";
import { getAlgodClient, makeRelayAddress, makeRelaySigner } from "../lib/relay-wallet";
import {
  getDeployedAppIds,
  BallotBoxClient,
  PollFactoryClient,
} from "@workspace/al0-contracts";

const router: IRouter = Router();

const NETWORK = process.env["ALGORAND_NETWORK"] ?? "mainnet";
const INDEXER_BASE = `https://${NETWORK}-idx.algonode.cloud/v2`;

interface IndexerBox { name: string }

async function fetchAllBoxes(appId: number): Promise<IndexerBox[]> {
  const boxes: IndexerBox[] = [];
  let nextToken: string | undefined;
  do {
    const url = new URL(`${INDEXER_BASE}/applications/${appId}/boxes`);
    url.searchParams.set("limit", "1000");
    if (nextToken) url.searchParams.set("next", nextToken);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Indexer error ${res.status}`);
    const data = (await res.json()) as { boxes?: IndexerBox[]; "next-token"?: string };
    boxes.push(...(data.boxes ?? []));
    nextToken = data["next-token"];
  } while (nextToken);
  return boxes;
}

function b64ToBuffer(b64: string): Buffer { return Buffer.from(b64, "base64"); }
function isPollBox(buf: Buffer) { return buf.length === 10 && buf[0] === 0x70 && buf[1] === 0x3a; }
function isVoteBox(buf: Buffer) { return buf.length === 42 && buf[0] === 0x76 && buf[1] === 0x3a; }
function isRegistryBox(buf: Buffer) { return buf.length >= 4 && buf[0] === 0x73 && buf[1] === 0x3a; }

/**
 * GET /api/admin/ops/overview
 * Relay balance + on-chain counts + DB counts
 */
router.get("/admin/ops/overview", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const appIds = getDeployedAppIds();

  const [dbCounts, relayInfo, onChain] = await Promise.allSettled([
    Promise.all([
      db.select({ c: count() }).from(apiKeysTable).where(isNull(apiKeysTable.revokedAt)),
      db.select({ c: count() }).from(apiKeysTable),
      db.select({ c: count() }).from(waitlistTable),
      db.select({ c: count() }).from(swarmWallets),
    ]),
    (async () => {
      const algod = getAlgodClient();
      const addr = makeRelayAddress();
      const info = await algod.accountInformation(addr).do();
      return {
        address: addr,
        balanceMicroAlgo: Number(info.amount),
        balanceAlgo: Number(info.amount) / 1_000_000,
        minBalance: Number(info.minBalance),
      };
    })(),
    (async () => {
      if (!appIds.pollFactoryAppId || !appIds.ballotBoxAppId || !appIds.agentRegistryAppId) {
        return null;
      }
      const [pollBoxes, voteBoxes, regBoxes] = await Promise.all([
        fetchAllBoxes(appIds.pollFactoryAppId),
        fetchAllBoxes(appIds.ballotBoxAppId),
        fetchAllBoxes(appIds.agentRegistryAppId),
      ]);
      return {
        polls: pollBoxes.filter((b) => isPollBox(b64ToBuffer(b.name))).length,
        votes: voteBoxes.filter((b) => isVoteBox(b64ToBuffer(b.name))).length,
        agents: regBoxes.filter((b) => isRegistryBox(b64ToBuffer(b.name))).length,
      };
    })(),
  ]);

  const db_ = dbCounts.status === "fulfilled" ? dbCounts.value : null;
  const relay = relayInfo.status === "fulfilled" ? relayInfo.value : null;
  const chain = onChain.status === "fulfilled" ? onChain.value : null;

  res.json({
    db: db_
      ? {
          activeAccounts: db_[0][0]?.c ?? 0,
          totalAccounts: db_[1][0]?.c ?? 0,
          waitlistSignups: db_[2][0]?.c ?? 0,
          swarmWallets: db_[3][0]?.c ?? 0,
        }
      : null,
    relay,
    onChain: chain,
    contracts: {
      network: NETWORK,
      agentRegistry: appIds.agentRegistryAppId ?? null,
      pollFactory: appIds.pollFactoryAppId ?? null,
      ballotBox: appIds.ballotBoxAppId ?? null,
    },
  });
});

/**
 * GET /api/admin/ops/accounts
 * List all API key accounts
 */
router.get("/admin/ops/accounts", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: apiKeysTable.id,
      email: apiKeysTable.swarmOwnerEmail,
      name: apiKeysTable.name,
      plan: apiKeysTable.plan,
      txCount: apiKeysTable.txCountThisPeriod,
      overageVotes: apiKeysTable.overageVotes,
      stripeCustomerId: apiKeysTable.stripeCustomerId,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
      periodResetAt: apiKeysTable.periodResetAt,
    })
    .from(apiKeysTable)
    .orderBy(desc(apiKeysTable.createdAt))
    .limit(200);

  res.json(rows);
});

/**
 * GET /api/admin/ops/logs?n=200
 * Recent server log entries from in-memory ring buffer
 */
router.get("/admin/ops/logs", requireAdmin, (req: Request, res: Response): void => {
  const n = Math.min(parseInt(String(req.query["n"] ?? "200"), 10) || 200, 500);
  res.json(getRecentLogs(n));
});

/**
 * POST /api/admin/ops/trigger-cleanup
 * Scan all expired polls and recycle vote-box MBR
 */
router.post("/admin/ops/trigger-cleanup", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const appIds = getDeployedAppIds();
  if (!appIds.ballotBoxAppId || !appIds.pollFactoryAppId) {
    res.status(503).json({ error: "Contracts not configured" });
    return;
  }

  const algod = getAlgodClient();
  const sender = makeRelayAddress();
  const signer = makeRelaySigner();
  const factory = new PollFactoryClient(appIds.pollFactoryAppId, algod);
  const ballot = new BallotBoxClient(appIds.ballotBoxAppId, algod);

  let nextPollId: bigint;
  try {
    nextPollId = await factory.getNextPollId();
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch poll count from chain" });
    return;
  }

  const results: Array<{ pollId: number; deleted: number; failed: number; mbrRecoveredAlgo: number }> = [];

  for (let pollId = 0; pollId < Number(nextPollId); pollId++) {
    try {
      const isActive = await factory.isActive({ poll_id: BigInt(pollId) });
      if (isActive) continue;

      const voters = await ballot.getVotersForPoll(pollId);
      if (voters.length === 0) continue;

      const sp = await algod.getTransactionParams().do();
      let deleted = 0;
      let failed = 0;

      for (const voter of voters) {
        try {
          await ballot.deleteVoteBox(sender, signer, { poll_id: pollId, voter }, sp);
          deleted++;
        } catch {
          failed++;
        }
      }

      results.push({ pollId, deleted, failed, mbrRecoveredAlgo: (deleted * 22_500) / 1_000_000 });
    } catch {
      // skip unreadable polls
    }
  }

  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  const totalRecovered = results.reduce((s, r) => s + r.mbrRecoveredAlgo, 0);

  res.json({
    pollsProcessed: results.length,
    totalVoteBoxesDeleted: totalDeleted,
    totalMbrRecoveredAlgo: totalRecovered,
    details: results,
  });
});

export default router;
