import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One Algorand signing account per registered swarm.
 *
 * The relay layer uses this account as the on-chain voter identity so that
 * each swarm has a unique address — enabling one vote per swarm per poll
 * and unlimited parallel vote throughput across swarms.
 *
 * algo_sk_encrypted: AES-256-GCM ciphertext of the 25-word mnemonic.
 * Format: hex(iv):hex(authTag):hex(ciphertext)
 * Encryption key is derived from the SESSION_SECRET env var.
 */
export const swarmWallets = pgTable("swarm_wallets", {
  swarmId:         text("swarm_id").primaryKey(),
  algoAddress:     text("algo_address").notNull(),
  algoSkEncrypted: text("algo_sk_encrypted").notNull(),
  createdAt:       timestamp("created_at",     { withTimezone: true }).defaultNow().notNull(),
  lastFundedAt:    timestamp("last_funded_at", { withTimezone: true }),
});

export type SwarmWalletRow = typeof swarmWallets.$inferSelect;
