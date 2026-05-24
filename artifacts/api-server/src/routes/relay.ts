import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { relayTransactionsTable, apiKeySwarms } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  AgentRegistryClient,
  PollFactoryClient,
  BallotBoxClient,
  getDeployedAppIds,
} from "@workspace/al0-contracts";
import { requireApiKey, type AuthenticatedRequest } from "../lib/api-key-auth";
import { relayRateLimit } from "../lib/rate-limiter";
import { getAlgodClient, makeRelayAddress, makeRelaySigner } from "../lib/relay-wallet";
import { requireAdmin } from "../lib/admin-auth";
import { checkQuota } from "../lib/quota";

const router: IRouter = Router();

const relayMiddleware = [requireApiKey, relayRateLimit, checkQuota];

router.post(
  "/relay/register",
  ...relayMiddleware,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { swarm_id } = req.body as { swarm_id?: string };

    if (!swarm_id || typeof swarm_id !== "string") {
      res.status(400).json({ error: "swarm_id is required" });
      return;
    }
    if (swarm_id.length > 64) {
      res.status(400).json({ error: "swarm_id must be 64 characters or fewer" });
      return;
    }

    const apiKeyId = req.apiKeyRecord!.id;

    const existing = await db
      .select()
      .from(apiKeySwarms)
      .where(and(eq(apiKeySwarms.apiKeyId, apiKeyId), eq(apiKeySwarms.swarmId, swarm_id)));

    if (existing.length > 0) {
      res.status(409).json({ error: "swarm_id is already registered to this API key" });
      return;
    }

    const appIds = getDeployedAppIds();
    if (!appIds.agentRegistryAppId) {
      res.status(503).json({ error: "AgentRegistry contract is not deployed" });
      return;
    }

    const algod = getAlgodClient();
    const sender = makeRelayAddress();
    const signer = makeRelaySigner();
    const client = new AgentRegistryClient(appIds.agentRegistryAppId, algod);

    const { appId, txId } = await client.registerSwarm(sender, signer, { swarm_id });

    await db.insert(apiKeySwarms).values({ apiKeyId, swarmId: swarm_id });

    await db.insert(relayTransactionsTable).values({
      apiKeyId,
      txType: "register",
      algoTxId: txId,
      status: "confirmed",
    });

    req.log.info({ swarm_id, txId }, "relay/register submitted");

    res.status(201).json({
      swarm_id,
      appId: appId.toString(),
      txType: "register",
      txId,
    });
  },
);

router.post(
  "/relay/poll",
  ...relayMiddleware,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const {
      swarm_id,
      question,
      options,
      expires_at,
    } = req.body as {
      swarm_id?: string;
      question?: string;
      options?: string[];
      expires_at?: number;
    };

    if (!swarm_id || typeof swarm_id !== "string") {
      res.status(400).json({ error: "swarm_id is required" });
      return;
    }
    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "question is required" });
      return;
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
      res.status(400).json({ error: "options must be an array of 2–8 strings" });
      return;
    }
    if (typeof expires_at !== "number" || expires_at <= 0) {
      res.status(400).json({ error: "expires_at must be a positive unix timestamp (seconds)" });
      return;
    }

    const apiKeyId = req.apiKeyRecord!.id;

    const ownership = await db
      .select()
      .from(apiKeySwarms)
      .where(and(eq(apiKeySwarms.apiKeyId, apiKeyId), eq(apiKeySwarms.swarmId, swarm_id)));

    if (ownership.length === 0) {
      res.status(403).json({ error: "This API key is not authorized to create polls for swarm_id: " + swarm_id });
      return;
    }

    const appIds = getDeployedAppIds();
    if (!appIds.pollFactoryAppId || !appIds.ballotBoxAppId) {
      res.status(503).json({ error: "PollFactory or BallotBox contract is not deployed" });
      return;
    }

    const algod = getAlgodClient();
    const sender = makeRelayAddress();
    const signer = makeRelaySigner();

    const typedOptions = options as [string, string, ...string[]];
    const pollClient = new PollFactoryClient(appIds.pollFactoryAppId, algod);
    let pollId: bigint;
    let pollTxId: string;
    let initTxId: string;
    try {
      ({ pollId, txId: pollTxId } = await pollClient.createPoll(
        sender,
        signer,
        { swarm_id, question, options: typedOptions, expires_at },
        appIds.agentRegistryAppId,
      ));

      const ballotClient = new BallotBoxClient(appIds.ballotBoxAppId, algod);
      ({ txId: initTxId } = await ballotClient.initPoll(
        sender,
        signer,
        { poll_id: Number(pollId) },
        appIds.pollFactoryAppId,
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("balance") && msg.includes("below min")) {
        req.log.error({ sender }, "relay/poll failed — relay wallet balance below minimum");
        res.status(503).json({
          error: "Relay wallet has insufficient ALGO balance. Top up: " + sender,
        });
      } else {
        req.log.error({ err, swarm_id }, "relay/poll Algorand error");
        res.status(502).json({ error: "Algorand transaction failed: " + msg });
      }
      return;
    }

    await db.insert(relayTransactionsTable).values([
      { apiKeyId, txType: "poll", algoTxId: pollTxId, status: "confirmed" },
      { apiKeyId, txType: "init_poll", algoTxId: initTxId, status: "confirmed" },
    ]);

    req.log.info({ swarm_id, pollId: pollId.toString(), pollTxId, initTxId }, "relay/poll submitted");

    res.status(201).json({
      swarm_id,
      pollId: pollId.toString(),
      txType: "poll",
      txId: pollTxId,
      initTxId,
    });
  },
);

router.post(
  "/relay/vote",
  ...relayMiddleware,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const {
      poll_id,
      option_index,
    } = req.body as {
      poll_id?: number;
      option_index?: number;
    };

    if (typeof poll_id !== "number" || poll_id < 0) {
      res.status(400).json({ error: "poll_id is required and must be a non-negative integer" });
      return;
    }
    if (typeof option_index !== "number" || option_index < 0) {
      res.status(400).json({ error: "option_index is required and must be a non-negative integer" });
      return;
    }

    const appIds = getDeployedAppIds();
    if (!appIds.pollFactoryAppId || !appIds.ballotBoxAppId) {
      res.status(503).json({ error: "PollFactory or BallotBox contract is not deployed" });
      return;
    }

    const algod = getAlgodClient();

    const pollClient = new PollFactoryClient(appIds.pollFactoryAppId, algod);
    let authoritativeSwarmId: string;
    try {
      const pollRecord = await pollClient.getPoll({ poll_id });
      authoritativeSwarmId = pollRecord.swarm_id;
    } catch {
      res.status(404).json({ error: "poll_id not found on-chain" });
      return;
    }

    const apiKeyId = req.apiKeyRecord!.id;
    const ownership = await db
      .select()
      .from(apiKeySwarms)
      .where(and(eq(apiKeySwarms.apiKeyId, apiKeyId), eq(apiKeySwarms.swarmId, authoritativeSwarmId)));

    if (ownership.length === 0) {
      res.status(403).json({
        error: "This API key is not authorized to vote on poll " + poll_id + " (swarm: " + authoritativeSwarmId + ")",
      });
      return;
    }

    const sender = makeRelayAddress();
    const signer = makeRelaySigner();
    const ballotClient = new BallotBoxClient(appIds.ballotBoxAppId, algod);
    let txId: string;
    try {
      ({ txId } = await ballotClient.castVote(sender, signer, { poll_id, option_index }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("balance") && msg.includes("below min")) {
        req.log.error({ sender }, "relay/vote failed — relay wallet balance below minimum");
        res.status(503).json({
          error: "Relay wallet has insufficient ALGO balance. Top up: " + sender,
        });
      } else if (msg.includes("has already voted") || msg.includes("box already exists")) {
        res.status(409).json({ error: "This swarm has already voted on poll " + poll_id });
      } else {
        req.log.error({ err, poll_id }, "relay/vote Algorand error");
        res.status(502).json({ error: "Algorand transaction failed: " + msg });
      }
      return;
    }

    await db.insert(relayTransactionsTable).values({
      apiKeyId,
      txType: "vote",
      algoTxId: txId,
      status: "confirmed",
    });

    req.log.info({ poll_id, option_index, swarm_id: authoritativeSwarmId, txId }, "relay/vote submitted");

    res.status(201).json({
      poll_id,
      option_index,
      swarm_id: authoritativeSwarmId,
      txType: "vote",
      txId,
    });
  },
);

router.get("/relay/wallet", requireAdmin, async (req, res): Promise<void> => {
  const mnemonic = process.env["RELAY_WALLET_MNEMONIC"];
  if (!mnemonic) {
    res.status(503).json({ error: "RELAY_WALLET_MNEMONIC is not configured" });
    return;
  }

  try {
    const algod = getAlgodClient();
    const address = makeRelayAddress();
    const info = await algod.accountInformation(address).do();
    const balanceMicroAlgo = Number(info.amount);

    res.json({
      address,
      balanceAlgo: balanceMicroAlgo / 1_000_000,
      balanceMicroAlgo,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch relay wallet balance");
    res.status(502).json({ error: "Failed to fetch wallet balance from Algorand node" });
  }
});

export default router;
