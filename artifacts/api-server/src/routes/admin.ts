import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { waitlistTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";

const router: IRouter = Router();

const REALM = "Agent Layer 0 Admin";

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

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

router.get("/admin/waitlist", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(waitlistTable)
      .orderBy(desc(waitlistTable.createdAt));

    const tableRows = rows
      .map((r) => {
        const created = r.createdAt.toISOString().replace("T", " ").slice(0, 19);
        return `<tr>
          <td>${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.buildingWith ?? "")}</td>
          <td class="mono">${escapeHtml(created)} UTC</td>
        </tr>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>[ Agent Layer Zero ] — Waitlist (${rows.length})</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0d0d10;
    color: #f5f5f5;
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 32px 24px;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  h1 { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
  h1 .b { color: #E8541C; opacity: 0.9; }
  .count { color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 4px; }
  .actions a {
    display: inline-block;
    padding: 9px 14px;
    background: #E8541C;
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 0 24px -8px rgba(232,84,28,0.6);
  }
  .actions a:hover { background: #ff6630; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  th {
    font-weight: 600;
    color: rgba(255,255,255,0.55);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom-color: rgba(255,255,255,0.15);
  }
  tr:hover td { background: rgba(232,84,28,0.04); }
  td.mono { font-size: 12px; color: rgba(255,255,255,0.6); }
  .empty { color: rgba(255,255,255,0.4); padding: 48px 12px; text-align: center; font-size: 14px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1><span class="b">[</span> Waitlist <span class="b">]</span></h1>
        <div class="count">${rows.length} ${rows.length === 1 ? "signup" : "signups"}</div>
      </div>
      <div class="actions">
        <a href="/api/admin/waitlist.csv" download>Download CSV</a>
      </div>
    </header>
    ${
      rows.length === 0
        ? `<div class="empty">No signups yet.</div>`
        : `<table>
            <thead>
              <tr><th>Email</th><th>Building with</th><th>Joined</th></tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>`
    }
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (err) {
    req.log.error(err, "Failed to load admin waitlist");
    res.status(500).send("Failed to load waitlist.");
  }
});

router.get("/admin/waitlist.csv", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(waitlistTable)
      .orderBy(desc(waitlistTable.createdAt));

    const lines = ["email,building_with,created_at"];
    for (const r of rows) {
      lines.push(
        [csvEscape(r.email), csvEscape(r.buildingWith), csvEscape(r.createdAt.toISOString())].join(","),
      );
    }
    const csv = lines.join("\n") + "\n";

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="agent-layer-0-waitlist-${stamp}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  } catch (err) {
    req.log.error(err, "Failed to export waitlist CSV");
    res.status(500).send("Failed to export waitlist.");
  }
});

export default router;
