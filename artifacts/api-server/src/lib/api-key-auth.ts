import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { isNull, eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  apiKeyRecord?: typeof apiKeysTable.$inferSelect;
}

export async function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header. Expected: Bearer <api_key>" });
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    res.status(401).json({ error: "Empty API key" });
    return;
  }

  const activeKeys = await db
    .select()
    .from(apiKeysTable)
    .where(isNull(apiKeysTable.revokedAt));

  let matched: typeof apiKeysTable.$inferSelect | null = null;
  for (const row of activeKeys) {
    const ok = await bcrypt.compare(rawKey, row.hashedKey);
    if (ok) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, matched.id));

  req.apiKeyRecord = matched;
  next();
}
