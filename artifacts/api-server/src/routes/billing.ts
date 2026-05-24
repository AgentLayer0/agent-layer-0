import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, PLAN_QUOTAS } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireApiKey, type AuthenticatedRequest } from "../lib/api-key-auth";
import { getUncachableStripeClient } from "../stripeClient";
import { WebhookHandlers } from "../webhookHandlers";

const router: IRouter = Router();

const DASHBOARD_BASE = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]}/dashboard`
  : "http://localhost:80/dashboard";

function getAllowedPriceIds(): Set<string> {
  const ids = new Set<string>();
  const pro = process.env["STRIPE_PRO_PRICE_ID"];
  const scale = process.env["STRIPE_SCALE_PRICE_ID"];
  if (pro) ids.add(pro);
  if (scale) ids.add(scale);
  return ids;
}

router.post("/billing/checkout", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { priceId } = req.body as { priceId?: string };

  if (!priceId || typeof priceId !== "string") {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  const allowed = getAllowedPriceIds();
  if (!allowed.has(priceId)) {
    res.status(400).json({ error: "Invalid priceId. Use GET /api/billing/plans to list valid price IDs." });
    return;
  }

  const keyRecord = req.apiKeyRecord!;
  const stripe = await getUncachableStripeClient();

  let customerId = keyRecord.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: keyRecord.swarmOwnerEmail,
      metadata: { apiKeyId: String(keyRecord.id) },
    });
    customerId = customer.id;
    await db
      .update(apiKeysTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(apiKeysTable.id, keyRecord.id));
    req.log.info({ customerId, apiKeyId: keyRecord.id }, "Stripe customer created");
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${DASHBOARD_BASE}/overview?billing=success`,
    cancel_url: `${DASHBOARD_BASE}/overview?billing=cancel`,
  });

  req.log.info({ sessionId: session.id, apiKeyId: keyRecord.id }, "checkout session created");
  res.json({ url: session.url });
});

router.post("/billing/portal", requireApiKey, async (req: AuthenticatedRequest, res): Promise<void> => {
  const keyRecord = req.apiKeyRecord!;

  if (!keyRecord.stripeCustomerId) {
    res.status(400).json({
      error: "No Stripe customer associated with this API key. Complete a checkout first.",
    });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: keyRecord.stripeCustomerId,
    return_url: `${DASHBOARD_BASE}/overview`,
  });

  req.log.info({ apiKeyId: keyRecord.id }, "portal session created");
  res.json({ url: session.url });
});

router.get("/billing/plans", async (_req, res): Promise<void> => {
  const proPriceId = process.env["STRIPE_PRO_PRICE_ID"] ?? null;
  const scalePriceId = process.env["STRIPE_SCALE_PRICE_ID"] ?? null;

  res.json({
    plans: [
      {
        id: "free",
        name: "Free",
        price: 0,
        quota: PLAN_QUOTAS.free,
        priceId: null,
        description: `${PLAN_QUOTAS.free} relay transactions/month`,
      },
      {
        id: "pro",
        name: "Pro",
        price: 2900,
        quota: PLAN_QUOTAS.pro,
        priceId: proPriceId,
        description: `${PLAN_QUOTAS.pro.toLocaleString()} relay transactions/month`,
      },
      {
        id: "scale",
        name: "Scale",
        price: 9900,
        quota: PLAN_QUOTAS.scale,
        priceId: scalePriceId,
        description: `${PLAN_QUOTAS.scale.toLocaleString()} relay transactions/month`,
      },
    ],
  });
});

export { router as billingRouter };

export function makeBillingWebhookHandler() {
  return async (req: import("express").Request, res: import("express").Response): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }

    const sig = Array.isArray(signature) ? signature[0] : signature;

    if (!Buffer.isBuffer(req.body)) {
      res.status(500).json({ error: "Webhook processing error: body not a Buffer" });
      return;
    }

    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      req.log?.error({ err }, "Stripe webhook processing error");
      res.status(500).json({ error: "Webhook processing error: " + message });
    }
  };
}
