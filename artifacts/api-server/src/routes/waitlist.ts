import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { waitlistTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import {
  CreateWaitlistSignupBody,
  CreateWaitlistSignupResponse,
  GetWaitlistStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/waitlist", async (req, res) => {
  const parsed = CreateWaitlistSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const buildingWith = parsed.data.buildingWith?.trim() || null;

  try {
    const inserted = await db
      .insert(waitlistTable)
      .values({ email, buildingWith })
      .onConflictDoNothing({ target: waitlistTable.email })
      .returning({ id: waitlistTable.id });

    const alreadyOnList = inserted.length === 0;
    const data = CreateWaitlistSignupResponse.parse({
      ok: true,
      alreadyOnList,
    });
    res.status(alreadyOnList ? 200 : 201).json(data);
  } catch (err) {
    req.log.error(err, "Failed to create waitlist signup");
    res.status(500).json({ error: "Failed to create waitlist signup" });
  }
});

const BUILDING_LABELS: Record<string, string> = {
  startup: "A startup product",
  internal: "An internal tool",
  research: "A research project",
  custom: "A custom agent",
  dao: "A DAO",
  other: "Other",
  "": "Not specified",
};

router.get("/waitlist/stats", async (req, res) => {
  try {
    const rows = await db
      .select({
        buildingWith: waitlistTable.buildingWith,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(waitlistTable)
      .groupBy(waitlistTable.buildingWith);

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    const breakdown = rows
      .map((r) => {
        const value = r.buildingWith ?? "";
        return {
          value,
          label: BUILDING_LABELS[value] ?? value,
          count: r.count,
          percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    const data = GetWaitlistStatsResponse.parse({ total, breakdown });
    res.json(data);
  } catch (err) {
    req.log.error(err, "Failed to fetch waitlist stats");
    res.status(500).json({ error: "Failed to fetch waitlist stats" });
  }
});

export default router;
