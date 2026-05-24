import { Router, type IRouter } from "express";
import { getDeployedAppIds } from "@workspace/al0-contracts";

const router: IRouter = Router();

const INDEXER_BASE = "https://testnet-idx.algonode.cloud/v2";

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
    if (!res.ok) throw new Error(`Indexer error ${res.status} for app ${appId}`);
    const data = (await res.json()) as { boxes?: IndexerBox[]; "next-token"?: string };
    boxes.push(...(data.boxes ?? []));
    nextToken = data["next-token"];
  } while (nextToken);
  return boxes;
}

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function isPollBox(buf: Buffer): boolean {
  return buf.length === 10 && buf[0] === 0x70 && buf[1] === 0x3a;
}

function isVoteBox(buf: Buffer): boolean {
  return buf.length === 42 && buf[0] === 0x76 && buf[1] === 0x3a;
}

function isRegistryBox(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x73 && buf[1] === 0x3a;
}

/**
 * GET /api/stats
 * Public — no auth required.
 * Returns on-chain counts of polls, votes, and registered agents by querying
 * the Algorand Testnet Indexer using the deployed AL0 contract app IDs.
 */
router.get("/stats", async (req, res): Promise<void> => {
  const appIds = getDeployedAppIds();

  if (
    !appIds.pollFactoryAppId ||
    !appIds.ballotBoxAppId ||
    !appIds.agentRegistryAppId
  ) {
    res.status(503).json({
      error: "AL0 contracts not deployed",
      polls: 0,
      votes: 0,
      agents: 0,
    });
    return;
  }

  try {
    const [pollBoxes, voteBoxes, registryBoxes] = await Promise.all([
      fetchAllBoxes(appIds.pollFactoryAppId),
      fetchAllBoxes(appIds.ballotBoxAppId),
      fetchAllBoxes(appIds.agentRegistryAppId),
    ]);

    const polls = pollBoxes.filter((b) => isPollBox(b64ToBuffer(b.name))).length;
    const votes = voteBoxes.filter((b) => isVoteBox(b64ToBuffer(b.name))).length;
    const agents = registryBoxes.filter((b) => isRegistryBox(b64ToBuffer(b.name))).length;

    res.json({ polls, votes, agents });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch AL0 stats from Algorand Indexer");
    res.status(502).json({ error: "Failed to fetch stats from Algorand Indexer" });
  }
});

export default router;
