import { type Response, type NextFunction } from "express";
import { type AuthenticatedRequest } from "./api-key-auth";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = parseInt(process.env["RELAY_RATE_LIMIT"] ?? "10", 10);

const store = new Map<number, number[]>();

export function relayRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const keyRecord = req.apiKeyRecord;
  if (!keyRecord) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const keyId = keyRecord.id;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (store.get(keyId) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= DEFAULT_LIMIT) {
    res.status(429).json({
      error: "Rate limit exceeded",
      limit: DEFAULT_LIMIT,
      window: "60s",
      retryAfter: Math.ceil((timestamps[0]! - windowStart) / 1000),
    });
    return;
  }

  timestamps.push(now);
  store.set(keyId, timestamps);

  next();
}
