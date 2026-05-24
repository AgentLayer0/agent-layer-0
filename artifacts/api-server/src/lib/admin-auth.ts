import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function parseBasicAuth(header: string | undefined): { user: string; pass: string } | null {
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

const REALM = "Agent Layer 0 Admin";

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const expectedEmail = process.env["ADMIN_EMAIL"];
  const expectedHash = process.env["ADMIN_PASSWORD_HASH"];

  if (!expectedEmail || !expectedHash) {
    req.log.error("ADMIN_EMAIL or ADMIN_PASSWORD_HASH not configured");
    res.status(503).send("Admin access is not configured.");
    return;
  }

  const creds = parseBasicAuth(req.headers.authorization);
  if (!creds) {
    res.set("WWW-Authenticate", `Basic realm="${REALM}", charset="UTF-8"`);
    res.status(401).send("Authentication required.");
    return;
  }

  const emailMatches = safeEqual(
    creds.user.trim().toLowerCase(),
    expectedEmail.trim().toLowerCase(),
  );
  const passMatches = await bcrypt.compare(creds.pass, expectedHash);

  if (!emailMatches || !passMatches) {
    res.set("WWW-Authenticate", `Basic realm="${REALM}", charset="UTF-8"`);
    res.status(401).send("Invalid credentials.");
    return;
  }

  next();
}
