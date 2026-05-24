import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  hashedKey: text("hashed_key").notNull().unique(),
  swarmOwnerEmail: text("swarm_owner_email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
});
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;

export const apiKeySwarms = pgTable("api_key_swarms", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id")
    .notNull()
    .references(() => apiKeysTable.id),
  swarmId: text("swarm_id").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
});

export const relayTransactionsTable = pgTable("relay_transactions", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id")
    .notNull()
    .references(() => apiKeysTable.id),
  txType: text("tx_type").notNull(),
  algoTxId: text("algo_tx_id").notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRelayTransactionSchema = createInsertSchema(relayTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRelayTransaction = z.infer<typeof insertRelayTransactionSchema>;
export type RelayTransaction = typeof relayTransactionsTable.$inferSelect;
