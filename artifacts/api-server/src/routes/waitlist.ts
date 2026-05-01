import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { waitlistTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { GetWaitlistStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

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
