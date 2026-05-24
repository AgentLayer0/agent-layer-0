import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("Creating AL0 billing plans in Stripe...");

  const existing = await stripe.products.search({ query: "metadata['al0_plan']:'pro'" });
  if (existing.data.length > 0) {
    console.log("AL0 billing plans already exist. Skipping creation.");

    const proProd = existing.data[0]!;
    const proPrices = await stripe.prices.list({ product: proProd.id, active: true });
    console.log(`Pro product: ${proProd.id}`);
    for (const p of proPrices.data) {
      console.log(`  Pro price: ${p.id}  amount: $${(p.unit_amount ?? 0) / 100}/mo`);
    }

    const scaleExisting = await stripe.products.search({ query: "metadata['al0_plan']:'scale'" });
    if (scaleExisting.data.length > 0) {
      const scaleProd = scaleExisting.data[0]!;
      const scalePrices = await stripe.prices.list({ product: scaleProd.id, active: true });
      console.log(`Scale product: ${scaleProd.id}`);
      for (const p of scalePrices.data) {
        console.log(`  Scale price: ${p.id}  amount: $${(p.unit_amount ?? 0) / 100}/mo`);
      }
    }

    console.log("\nSet these price IDs in your env vars:");
    console.log("  STRIPE_PRO_PRICE_ID=<pro price id above>");
    console.log("  STRIPE_SCALE_PRICE_ID=<scale price id above>");
    return;
  }

  const proProduct = await stripe.products.create({
    name: "AL0 Pro",
    description: "Agent Layer 0 Pro — 10,000 relay transactions/month",
    metadata: { al0_plan: "pro", quota: "10000" },
  });
  console.log(`Created Pro product: ${proProduct.id}`);

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 2900,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { al0_plan: "pro" },
  });
  console.log(`Created Pro price: ${proPrice.id} ($29.00/month)`);

  const scaleProduct = await stripe.products.create({
    name: "AL0 Scale",
    description: "Agent Layer 0 Scale — 100,000 relay transactions/month",
    metadata: { al0_plan: "scale", quota: "100000" },
  });
  console.log(`Created Scale product: ${scaleProduct.id}`);

  const scalePrice = await stripe.prices.create({
    product: scaleProduct.id,
    unit_amount: 9900,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { al0_plan: "scale" },
  });
  console.log(`Created Scale price: ${scalePrice.id} ($99.00/month)`);

  console.log("\n✓ Products and prices created successfully!");
  console.log("\nAdd these to your environment variables:");
  console.log(`  STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log(`  STRIPE_SCALE_PRICE_ID=${scalePrice.id}`);
}

createProducts().catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
