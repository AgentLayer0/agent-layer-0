import { useQuery } from "@tanstack/react-query";
import { AL0Wordmark } from "@/components/AL0Logo";

interface StatItem {
  value: string;
  label: string;
  count: number;
  percentage: number;
}

interface WaitlistStats {
  total: number;
  breakdown: StatItem[];
}

async function fetchWaitlistStats(): Promise<WaitlistStats> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/waitlist/stats`);
  if (!res.ok) throw new Error("Failed to fetch waitlist stats");
  return res.json();
}

const CATEGORY_COLORS: Record<string, string> = {
  startup: "#E8541C",
  internal: "#f97316",
  research: "#fb923c",
  custom: "#fdba74",
  dao: "#fed7aa",
  other: "#6b7280",
  "": "#374151",
};

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["waitlist-stats"],
    queryFn: fetchWaitlistStats,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto border-b border-border/40">
        <AL0Wordmark size="md" />
        <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
          Dashboard
        </span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Waitlist Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Live breakdown of what people on the waitlist are building.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground text-sm font-mono animate-pulse">
              Loading stats…
            </div>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-6 text-center">
            <p className="text-destructive text-sm font-mono">
              Failed to load waitlist stats. Please try again later.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl border border-border/40 bg-card px-6 py-5 mb-6 flex items-center gap-4">
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
                  Total Signups
                </p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {data.total.toLocaleString()}
                </p>
              </div>
            </div>

            {data.total === 0 ? (
              <div className="rounded-xl border border-border/40 bg-card px-6 py-10 text-center">
                <p className="text-muted-foreground text-sm font-mono">
                  No signups yet. Check back soon.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
                  Building breakdown
                </p>
                {data.breakdown.map((item) => (
                  <div
                    key={item.value}
                    className="rounded-xl border border-border/40 bg-card px-5 py-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-xs text-muted-foreground">
                          {item.count.toLocaleString()} {item.count === 1 ? "signup" : "signups"}
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: CATEGORY_COLORS[item.value] ?? "#E8541C" }}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: CATEGORY_COLORS[item.value] ?? "#E8541C",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-8 text-xs text-muted-foreground/40 font-mono text-right">
              Refreshes every 30 seconds
            </p>
          </>
        )}
      </main>
    </div>
  );
}
