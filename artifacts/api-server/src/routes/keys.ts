import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { apiKeysTable, apiKeySwarms, relayTransactionsTable, PLAN_QUOTAS, type Plan } from "@workspace/db/schema";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-auth";
import { requireApiKey, type AuthenticatedRequest } from "../lib/api-key-auth";
import { getDeployedAppIds } from "@workspace/al0-contracts";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

function generateRawKey(): string {
  return "al0_" + randomBytes(32).toString("hex");
}

router.post("/keys", requireAdmin, async (req, res): Promise<void> => {
  const { swarmOwnerEmail, name } = req.body as { swarmOwnerEmail?: string; name?: string };

  if (!swarmOwnerEmail || typeof swarmOwnerEmail !== "string") {
    res.status(400).json({ error: "swarmOwnerEmail is required" });
    return;
  }

  const email = swarmOwnerEmail.trim().toLowerCase();
  const rawKey = generateRawKey();
  const hashedKey = await bcrypt.hash(rawKey, 12);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [record] = await db
    .insert(apiKeysTable)
    .values({
      hashedKey,
      swarmOwnerEmail: email,
      name: name ?? null,
      plan: "free",
      periodResetAt: thirtyDaysFromNow,
    })
    .returning();

  req.log.info({ id: record!.id, swarmOwnerEmail: email }, "API key created");

  let stripeCustomerId: string | null = null;
  try {
    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      email,
      metadata: { apiKeyId: String(record!.id) },
    });
    stripeCustomerId = customer.id;
    await db
      .update(apiKeysTable)
      .set({ stripeCustomerId })
      .where(eq(apiKeysTable.id, record!.id));
    req.log.info({ id: record!.id, stripeCustomerId }, "Stripe customer created for new API key");
  } catch (err) {
    req.log.warn({ err }, "Failed to create Stripe customer — billing features will be unavailable for this key");
  }

  res.status(201).json({
    id: record!.id,
    key: rawKey,
    swarmOwnerEmail: record!.swarmOwnerEmail,
    name: record!.name,
    plan: record!.plan,
    stripeCustomerId,
    createdAt: record!.createdAt,
    warning: "This is the only time the raw key will be shown. Store it securely.",
  });
});

router.get("/keys", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: apiKeysTable.id,
      swarmOwnerEmail: apiKeysTable.swarmOwnerEmail,
      name: apiKeysTable.name,
      plan: apiKeysTable.plan,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
    })
    .from(apiKeysTable)
    .orderBy(apiKeysTable.createdAt);

  res.json({ keys: rows });
});

router.delete("/keys/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(rawId ?? "", 10);

  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid key id" });
    return;
  }

  const [row] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeysTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  req.log.info({ id }, "API key revoked");
  res.json({ id: row.id, revokedAt: row.revokedAt });
});

router.delete("/keys/me", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.apiKeyRecord!.id;
  const [row] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeysTable.id, id))
    .returning();

  req.log.info({ id }, "API key self-revoked");
  res.json({ id: row!.id, revokedAt: row!.revokedAt });
});

router.get("/keys/me/transactions", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const keyRecord = req.apiKeyRecord!;
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "25"), 10) || 25, 100);

  const rows = await db
    .select({
      id: relayTransactionsTable.id,
      txType: relayTransactionsTable.txType,
      algoTxId: relayTransactionsTable.algoTxId,
      status: relayTransactionsTable.status,
      createdAt: relayTransactionsTable.createdAt,
    })
    .from(relayTransactionsTable)
    .where(eq(relayTransactionsTable.apiKeyId, keyRecord.id))
    .orderBy(desc(relayTransactionsTable.createdAt))
    .limit(limit);

  res.json({ transactions: rows });
});

router.get("/keys/me/context", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const keyRecord = req.apiKeyRecord!;
  const swarms = await db
    .select({ swarmId: apiKeySwarms.swarmId })
    .from(apiKeySwarms)
    .where(eq(apiKeySwarms.apiKeyId, keyRecord.id));
  const appIds = getDeployedAppIds();
  res.json({
    swarms: swarms.map((s) => s.swarmId),
    appIds: {
      agentRegistryAppId: appIds.agentRegistryAppId,
      pollFactoryAppId: appIds.pollFactoryAppId,
      ballotBoxAppId: appIds.ballotBoxAppId,
    },
  });
});

router.get("/keys/me/usage", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const keyRecord = req.apiKeyRecord!;

  const [stats] = await db
    .select({
      txCount: sql<number>`count(*)::int`,
    })
    .from(relayTransactionsTable)
    .where(eq(relayTransactionsTable.apiKeyId, keyRecord.id));

  const txCount = stats?.txCount ?? 0;
  const estimatedAlgoPerTx = 0.001;
  const plan = (keyRecord.plan ?? "free") as Plan;
  const quota = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;

  res.json({
    apiKeyId: keyRecord.id,
    swarmOwnerEmail: keyRecord.swarmOwnerEmail,
    name: keyRecord.name,
    plan,
    quota,
    txCountThisPeriod: keyRecord.txCountThisPeriod ?? 0,
    overageVotes: keyRecord.overageVotes ?? 0,
    periodResetAt: keyRecord.periodResetAt ?? null,
    hasStripeCustomer: !!keyRecord.stripeCustomerId,
    createdAt: keyRecord.createdAt,
    lastUsedAt: keyRecord.lastUsedAt,
    txCount,
    estimatedAlgoSpent: parseFloat((txCount * estimatedAlgoPerTx).toFixed(6)),
  });
});

export default router;
