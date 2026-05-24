import { getStripeSync } from "./stripeClient";
import { db } from "@workspace/db";
import { apiKeysTable, type Plan } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import type Stripe from "stripe";

function planFromPriceId(priceId: string): Plan | null {
  if (priceId === process.env["STRIPE_PRO_PRICE_ID"]) return "pro";
  if (priceId === process.env["STRIPE_SCALE_PRICE_ID"]) return "scale";
  return null;
}

async function handleSubscriptionUpdated(
  customerId: string,
  priceId: string,
  periodEndSecs: number,
): Promise<void> {
  const plan: Plan = planFromPriceId(priceId) ?? "free";
  const periodResetAt = new Date(periodEndSecs * 1000);

  const result = await db
    .update(apiKeysTable)
    .set({ plan, periodResetAt, txCountThisPeriod: 0 })
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .returning({ id: apiKeysTable.id });

  logger.info({ customerId, plan, rows: result.length }, "subscription updated: plan set");
}

async function handleSubscriptionDeleted(customerId: string): Promise<void> {
  const result = await db
    .update(apiKeysTable)
    .set({ plan: "free", txCountThisPeriod: 0, periodResetAt: sql`NOW() + INTERVAL '30 days'` })
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .returning({ id: apiKeysTable.id });

  logger.info({ customerId, rows: result.length }, "subscription deleted: reverted to free");
}

async function handleInvoicePaid(
  customerId: string,
  subscriptionData: unknown,
): Promise<void> {
  if (!subscriptionData || typeof subscriptionData !== "object") return;

  const sub = subscriptionData as Record<string, unknown>;
  const items = sub["items"] as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id;
  if (!priceId) return;

  const plan: Plan = planFromPriceId(priceId) ?? "free";
  const periodEnd = sub["current_period_end"];
  const periodResetAt =
    typeof periodEnd === "number"
      ? new Date(periodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const result = await db
    .update(apiKeysTable)
    .set({ plan, periodResetAt, txCountThisPeriod: 0 })
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .returning({ id: apiKeysTable.id });

  logger.info({ customerId, plan, rows: result.length }, "invoice paid: plan reset");
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " +
          typeof payload +
          ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    let event: Stripe.Event;
    try {
      event = JSON.parse(payload.toString()) as Stripe.Event;
    } catch {
      logger.warn("Failed to parse Stripe webhook payload as JSON");
      return;
    }

    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as unknown as Record<string, unknown>;
        const customerId = sub["customer"] as string;
        const items = sub["items"] as
          | { data?: Array<{ price?: { id?: string } }> }
          | undefined;
        const priceId = items?.data?.[0]?.price?.id ?? "";
        const periodEnd = sub["current_period_end"] as number | undefined;
        if (customerId && priceId && periodEnd) {
          await handleSubscriptionUpdated(customerId, priceId, periodEnd);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as Record<string, unknown>;
        const customerId = sub["customer"] as string;
        if (customerId) await handleSubscriptionDeleted(customerId);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as unknown as Record<string, unknown>;
        const customerId = inv["customer"] as string | undefined;
        const subscriptionData = inv["subscription_details"] ?? null;
        if (customerId) {
          await handleInvoicePaid(customerId, subscriptionData);
        }
        break;
      }
      default:
        break;
    }
  }
}
