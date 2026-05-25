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
import { getOrCreateSwarmWallet, ensureSwarmFunded } from "../lib/swarm-wallet";
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

    // Pre-create the per-swarm Algorand wallet so the first vote is fast.
    // getOrCreateSwarmWallet generates an account, encrypts the key, persists
    // it to DB, and seeds it from the relay wallet in one call.
    const swarmWallet = await getOrCreateSwarmWallet(swarm_id);

    await db.insert(relayTransactionsTable).values({
      apiKeyId,
      txType: "register",
      algoTxId: txId,
      status: "confirmed",
    });

    req.log.info({ swarm_id, txId, swarmAddress: swarmWallet.address }, "relay/register submitted");

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
    if (expires_at <= Math.floor(Date.now() / 1000)) {
      res.status(400).json({ error: "expires_at must be in the future" });
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
      req.log.error({ err: msg, sender, swarm_id }, "relay/poll Algorand error (raw)");
      if (msg.includes("balance") && msg.includes("below min")) {
        res.status(503).json({
          error: "Algorand account balance below minimum: " + msg,
        });
      } else {
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
    let pollOptionCount: number;
    try {
      const pollRecord = await pollClient.getPoll({ poll_id });
      authoritativeSwarmId = pollRecord.swarm_id;
      pollOptionCount = Number(pollRecord.option_count);
    } catch {
      res.status(404).json({ error: "poll_id not found on-chain" });
      return;
    }

    if (option_index >= pollOptionCount) {
      res.status(400).json({
        error: `option_index ${option_index} is out of range — poll has ${pollOptionCount} option(s) (0–${pollOptionCount - 1})`,
      });
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

    // Resolve the per-swarm signing account (creates + funds on first vote if
    // the swarm wallet was somehow not pre-created at registration time).
    const swarmWallet = await getOrCreateSwarmWallet(authoritativeSwarmId);

    // Ensure the swarm wallet has enough spendable ALGO to cover the MBR +
    // fees for this vote. Tops up from the relay wallet if below threshold.
    await ensureSwarmFunded(swarmWallet.address);

    const ballotClient = new BallotBoxClient(appIds.ballotBoxAppId, algod);

    // Pre-check: avoid sending a doomed transaction if swarm already voted.
    try {
      const alreadyVoted = await ballotClient.hasVoted({
        poll_id,
        voter: swarmWallet.address,
      });
      if (alreadyVoted) {
        res.status(409).json({ error: "This swarm has already voted on poll " + poll_id });
        return;
      }
    } catch {
      // hasVoted check failing is non-fatal — fall through and let castVote surface the error
    }

    let txId: string;
    try {
      ({ txId } = await ballotClient.castVote(
        swarmWallet.address,
        swarmWallet.signer,
        { poll_id, option_index },
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("balance") && msg.includes("below min")) {
        req.log.error({ swarmAddress: swarmWallet.address }, "relay/vote failed — swarm wallet balance below minimum");
        res.status(503).json({
          error: "Swarm wallet has insufficient ALGO balance. Swarm: " + authoritativeSwarmId,
        });
      } else {
        req.log.error({ err, poll_id, swarmAddress: swarmWallet.address }, "relay/vote Algorand error");
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

router.get(
  "/relay/polls",
  requireApiKey,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const appIds = getDeployedAppIds();
    if (!appIds.pollFactoryAppId || !appIds.ballotBoxAppId) {
      res.status(503).json({ error: "Contracts not deployed" });
      return;
    }
    const algod = getAlgodClient();
    const pollClient = new PollFactoryClient(appIds.pollFactoryAppId, algod);
    try {
      const nextId = await pollClient.getNextPollId();
      if (nextId === 0n) { res.json([]); return; }
      const ids = Array.from({ length: Number(nextId) }, (_, i) => i);
      const polls = await Promise.all(
        ids.map(async (id) => {
          const [record, isActive] = await Promise.all([
            pollClient.getPoll({ poll_id: id }),
            pollClient.isActive({ poll_id: id }),
          ]);
          const count = Number(record.option_count);
          const opts = [record.option_0, record.option_1, record.option_2, record.option_3,
            record.option_4, record.option_5, record.option_6, record.option_7].slice(0, count);
          return {
            id,
            question: record.question,
            swarmId: record.swarm_id,
            creator: record.creator,
            options: opts,
            optionCount: count,
            createdAt: Number(record.created_at),
            expiresAt: Number(record.expires_at),
            isActive,
          };
        })
      );
      res.json(polls);
    } catch (err) {
      req.log.error({ err }, "relay/polls list error");
      res.status(502).json({ error: "Failed to fetch polls from chain" });
    }
  },
);

router.get(
  "/relay/polls/:id",
  requireApiKey,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const pollId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(pollId) || pollId < 0) {
      res.status(400).json({ error: "Invalid poll id" });
      return;
    }
    const appIds = getDeployedAppIds();
    if (!appIds.pollFactoryAppId) {
      res.status(503).json({ error: "PollFactory not deployed" });
      return;
    }
    const algod = getAlgodClient();
    const pollClient = new PollFactoryClient(appIds.pollFactoryAppId, algod);
    try {
      const [record, isActive] = await Promise.all([
        pollClient.getPoll({ poll_id: pollId }),
        pollClient.isActive({ poll_id: pollId }),
      ]);
      const count = Number(record.option_count);
      const opts = [record.option_0, record.option_1, record.option_2, record.option_3,
        record.option_4, record.option_5, record.option_6, record.option_7].slice(0, count);
      res.json({
        id: pollId,
        question: record.question,
        swarmId: record.swarm_id,
        creator: record.creator,
        options: opts,
        optionCount: count,
        createdAt: Number(record.created_at),
        expiresAt: Number(record.expires_at),
        isActive,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("does not exist") || msg.includes("not found")) {
        res.status(404).json({ error: "Poll not found" });
      } else {
        req.log.error({ err, pollId }, "relay/polls/:id error");
        res.status(502).json({ error: "Failed to fetch poll from chain" });
      }
    }
  },
);

router.get(
  "/relay/polls/:id/results",
  requireApiKey,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const pollId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(pollId) || pollId < 0) {
      res.status(400).json({ error: "Invalid poll id" });
      return;
    }
    const appIds = getDeployedAppIds();
    if (!appIds.pollFactoryAppId || !appIds.ballotBoxAppId) {
      res.status(503).json({ error: "Contracts not deployed" });
      return;
    }
    const algod = getAlgodClient();
    const pollClient = new PollFactoryClient(appIds.pollFactoryAppId, algod);
    const ballotClient = new BallotBoxClient(appIds.ballotBoxAppId, algod);
    try {
      const [meta, tally] = await Promise.all([
        pollClient.getPollMeta({ poll_id: pollId }),
        ballotClient.getTally({ poll_id: pollId }),
      ]);
      const count = Number(meta.option_count);
      const allTallies = [tally.tally_0, tally.tally_1, tally.tally_2, tally.tally_3,
        tally.tally_4, tally.tally_5, tally.tally_6, tally.tally_7];
      const tallies = allTallies.slice(0, count).map(Number);
      const totalVotes = tallies.reduce((s, t) => s + t, 0);
      res.json({ pollId, tallies, totalVotes });
    } catch (err) {
      req.log.error({ err, pollId }, "relay/polls/:id/results error");
      res.status(502).json({ error: "Failed to fetch results from chain" });
    }
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
