import { type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, PLAN_QUOTAS, type Plan } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { type AuthenticatedRequest } from "./api-key-auth";

const DASHBOARD_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]}/dashboard`
  : "https://agentlayer0.com/dashboard";

export async function checkQuota(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const keyRecord = req.apiKeyRecord!;
  const plan = (keyRecord.plan ?? "free") as Plan;
  const quota = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;

  let txCount = keyRecord.txCountThisPeriod ?? 0;

  if (keyRecord.periodResetAt && new Date() > keyRecord.periodResetAt) {
    const newResetAt = new Date();
    newResetAt.setDate(newResetAt.getDate() + 30);
    await db
      .update(apiKeysTable)
      .set({ txCountThisPeriod: 0, periodResetAt: newResetAt })
      .where(eq(apiKeysTable.id, keyRecord.id));
    txCount = 0;
  }

  if (txCount >= quota) {
    const upgradeUrl = `${DASHBOARD_URL}/overview`;
    res.status(429).json({
      error: "Relay quota exceeded for this billing period.",
      plan,
      quota,
      txCountThisPeriod: txCount,
      upgradeUrl,
      message:
        plan === "free"
          ? `Free plan allows ${quota} relay transactions/month. Upgrade to Pro ($29/mo, 10k tx) or Scale ($99/mo, 100k tx) at ${upgradeUrl}`
          : `Your ${plan} plan allows ${quota.toLocaleString()} relay transactions/month. Manage your subscription at ${upgradeUrl}`,
    });
    return;
  }

  res.on("finish", () => {
    if (res.statusCode < 400) {
      db.update(apiKeysTable)
        .set({ txCountThisPeriod: sql`${apiKeysTable.txCountThisPeriod} + 1` })
        .where(eq(apiKeysTable.id, keyRecord.id))
        .catch((err: unknown) => {
          req.log.error({ err }, "Failed to increment tx_count_this_period");
        });
    }
  });

  next();
}
