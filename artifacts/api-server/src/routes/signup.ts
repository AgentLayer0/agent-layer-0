import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateRawKey(): string {
  return "al0_sk_" + randomBytes(24).toString("base64url");
}

/**
 * POST /api/signup
 * Public — no auth required.
 * Creates a free-tier API key for a new swarm owner.
 * Returns the raw key once — it is never stored in plaintext.
 */
router.post("/signup", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // One active key per email — prevents accidental duplicates.
  const existing = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(
      and(
        eq(apiKeysTable.swarmOwnerEmail, normalizedEmail),
        isNull(apiKeysTable.revokedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({
      error:
        "An API key is already registered for this email. Check your records or contact support to rotate it.",
    });
    return;
  }

  const rawKey = generateRawKey();
  const hashedKey = await bcrypt.hash(rawKey, 12);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [record] = await db
    .insert(apiKeysTable)
    .values({
      hashedKey,
      swarmOwnerEmail: normalizedEmail,
      name: "default",
      plan: "free",
      periodResetAt: thirtyDaysFromNow,
    })
    .returning();

  req.log.info({ id: record!.id, email: normalizedEmail }, "Self-service API key created");

  // Create Stripe customer in the background — don't block the response.
  (async () => {
    try {
      const stripe = await getUncachableStripeClient();
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        metadata: { apiKeyId: String(record!.id), source: "self-service-signup" },
      });
      await db
        .update(apiKeysTable)
        .set({ stripeCustomerId: customer.id })
        .where(eq(apiKeysTable.id, record!.id));
    } catch (err) {
      req.log.warn({ err, id: record!.id }, "Stripe customer creation failed at signup — billing features degraded");
    }
  })();

  res.status(201).json({
    key: rawKey,
    email: normalizedEmail,
    plan: "free",
    quota: 500,
    warning: "Store this key securely — it will not be shown again.",
    next: "Paste this key into the dashboard at /dashboard/ to manage your swarm.",
  });
});

export default router;
