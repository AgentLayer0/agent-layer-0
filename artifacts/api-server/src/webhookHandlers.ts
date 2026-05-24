import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
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
    .set({ plan, periodResetAt, txCountThisPeriod: 0, overageVotes: 0 })
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .returning({ id: apiKeysTable.id });

  logger.info({ customerId, plan, rows: result.length }, "subscription updated: plan set");
}

async function handleSubscriptionDeleted(customerId: string): Promise<void> {
  const result = await db
    .update(apiKeysTable)
    .set({ plan: "free", txCountThisPeriod: 0, overageVotes: 0, periodResetAt: sql`NOW() + INTERVAL '30 days'` })
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
    .set({ plan, periodResetAt, txCountThisPeriod: 0, overageVotes: 0 })
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .returning({ id: apiKeysTable.id });

  logger.info({ customerId, plan, rows: result.length }, "invoice paid: plan reset");
}

/**
 * When Stripe creates a new invoice (draft state, before finalization), check whether
 * the customer has accrued Scale plan overage votes. If so, add a line item for the
 * overage charge ($0.001/vote) to the invoice before it is finalized.
 *
 * Overage < 500 votes (~$0.50) is forgiven to stay above Stripe's minimum charge.
 */
async function handleInvoiceCreated(customerId: string, invoiceId: string): Promise<void> {
  const rows = await db
    .select({
      id: apiKeysTable.id,
      plan: apiKeysTable.plan,
      overageVotes: apiKeysTable.overageVotes,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.stripeCustomerId, customerId))
    .limit(1);

  const row = rows[0];
  if (!row || row.plan !== "scale" || (row.overageVotes ?? 0) === 0) return;

  const overageVotes = row.overageVotes ?? 0;
  // $0.001/vote → 0.1 cents/vote; Stripe requires integer cents
  const amountCents = Math.round(overageVotes * 0.1);

  if (amountCents < 50) {
    // Below Stripe minimum charge — reset without billing (small amounts forgiven)
    await db.update(apiKeysTable).set({ overageVotes: 0 }).where(eq(apiKeysTable.id, row.id));
    logger.info({ customerId, overageVotes, amountCents }, "overage below $0.50 minimum: forgiven");
    return;
  }

  const stripe = await getUncachableStripeClient();
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoiceId,
    amount: amountCents,
    currency: "usd",
    description: `Scale plan overage — ${overageVotes.toLocaleString()} relay votes above 100,000 ($0.001/vote)`,
  });

  await db.update(apiKeysTable).set({ overageVotes: 0 }).where(eq(apiKeysTable.id, row.id));
  logger.info({ customerId, overageVotes, amountCents, invoiceId }, "overage invoice item added");
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
      case "invoice.created": {
        const inv = event.data.object as unknown as Record<string, unknown>;
        const customerId = inv["customer"] as string | undefined;
        const invoiceId = inv["id"] as string | undefined;
        // Only act on subscription invoices (not one-off invoices)
        const hasSubscription = !!(inv["subscription"] ?? inv["subscription_details"]);
        if (customerId && invoiceId && hasSubscription) {
          await handleInvoiceCreated(customerId, invoiceId);
        }
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
