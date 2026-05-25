import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL;

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
});

function makeAuth(creds: string) {
  return { Authorization: `Basic ${creds}` };
}

async function apiFetch(path: string, creds: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...makeAuth(creds), ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] px-5 py-4">
      <div className="text-xs font-mono uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">{label}</div>
      <div className="text-2xl font-mono font-bold text-[hsl(var(--foreground))]">{value}</div>
      {sub && <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{sub}</div>}
    </div>
  );
}

function OverviewTab({ creds }: { creds: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: () => apiFetch("/admin/ops/overview", creds),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Loading />;
  if (error) return <Err msg={String(error)} />;

  const { db, relay, onChain, contracts } = data as {
    db: { activeAccounts: number; totalAccounts: number; waitlistSignups: number; swarmWallets: number } | null;
    relay: { address: string; balanceAlgo: number; minBalance: number } | null;
    onChain: { polls: number; votes: number; agents: number } | null;
    contracts: { network: string; agentRegistry: number | null; pollFactory: number | null; ballotBox: number | null };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">System Overview</h2>
        <button onClick={() => refetch()} className="text-xs font-mono text-[hsl(var(--primary))] hover:underline">↻ refresh</button>
      </div>

      <div>
        <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">On-chain</div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Agents" value={onChain?.agents ?? "—"} />
          <StatCard label="Polls" value={onChain?.polls ?? "—"} />
          <StatCard label="Votes" value={onChain?.votes ?? "—"} />
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">Accounts</div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Active API Keys" value={db?.activeAccounts ?? "—"} sub={`${db?.totalAccounts ?? 0} total`} />
          <StatCard label="Swarm Wallets" value={db?.swarmWallets ?? "—"} />
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">Relay Wallet</div>
        <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 space-y-2">
          {relay ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold">{relay.balanceAlgo.toFixed(3)}</span>
                <span className="text-[hsl(var(--muted-foreground))] font-mono text-sm">ALGO</span>
              </div>
              <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] break-all">{relay.address}</div>
            </>
          ) : <span className="text-[hsl(var(--muted-foreground))] text-sm">Unavailable</span>}
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">Contracts</div>
        <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 space-y-2">
          <Row label="Network" value={<Badge color={contracts.network === "mainnet" ? "orange" : "gray"}>{contracts.network}</Badge>} />
          <Row label="AgentRegistry" value={<Mono>{contracts.agentRegistry ?? "—"}</Mono>} />
          <Row label="PollFactory" value={<Mono>{contracts.pollFactory ?? "—"}</Mono>} />
          <Row label="BallotBox" value={<Mono>{contracts.ballotBox ?? "—"}</Mono>} />
        </div>
      </div>
    </div>
  );
}

function AccountsTab({ creds }: { creds: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch("/admin/ops/accounts", creds),
  });

  if (isLoading) return <Loading />;
  if (error) return <Err msg={String(error)} />;

  const rows = data as Array<{
    id: number; email: string; name: string | null; plan: string;
    txCount: number; overageVotes: number; stripeCustomerId: string | null;
    createdAt: string; lastUsedAt: string | null; revokedAt: string | null;
  }>;

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        API Keys ({rows.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">
              <th className="text-left py-2 pr-4">Email</th>
              <th className="text-left py-2 pr-4">Plan</th>
              <th className="text-right py-2 pr-4">Tx/Period</th>
              <th className="text-left py-2 pr-4">Status</th>
              <th className="text-left py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[hsl(var(--border))]/40 hover:bg-[hsl(var(--accent))]/30">
                <td className="py-2 pr-4 text-[hsl(var(--foreground))]">
                  {r.email}
                  {r.name && <span className="ml-2 text-[hsl(var(--muted-foreground))]">({r.name})</span>}
                </td>
                <td className="py-2 pr-4">
                  <Badge color={r.plan === "scale" ? "orange" : r.plan === "pro" ? "blue" : "gray"}>{r.plan}</Badge>
                </td>
                <td className="py-2 pr-4 text-right text-[hsl(var(--foreground))]">{r.txCount.toLocaleString()}</td>
                <td className="py-2 pr-4">
                  {r.revokedAt
                    ? <Badge color="red">revoked</Badge>
                    : <Badge color="green">active</Badge>}
                </td>
                <td className="py-2 text-[hsl(var(--muted-foreground))] text-xs">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))] font-mono text-sm">No accounts yet</div>
        )}
      </div>
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  info:  "text-blue-400",
  warn:  "text-yellow-400",
  error: "text-red-400",
  fatal: "text-red-600",
  debug: "text-[hsl(var(--muted-foreground))]",
  trace: "text-[hsl(var(--muted-foreground))]",
};

function LogsTab({ creds }: { creds: string }) {
  const [filter, setFilter] = useState<string>("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["logs"],
    queryFn: () => apiFetch("/admin/ops/logs?n=300", creds),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data]);

  if (isLoading) return <Loading />;
  if (error) return <Err msg={String(error)} />;

  const entries = (data as Array<{ time: number; levelLabel: string; msg: string; [k: string]: unknown }>)
    .filter((e) => filter === "all" || e.levelLabel === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Server Logs
        </h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">— refreshes every 5s —</span>
        <div className="ml-auto flex gap-2">
          {["all", "info", "warn", "error"].map((l) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                filter === l
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[#060608] p-3 h-[480px] overflow-y-auto font-mono text-xs space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-[hsl(var(--muted-foreground))] py-4 text-center">
            {data?.length === 0 ? "No logs captured yet — buffer fills as requests come in" : "No entries match filter"}
          </div>
        ) : (
          entries.map((e, i) => {
            const ts = new Date(e.time).toISOString().replace("T", " ").slice(0, 19);
            const extra = Object.entries(e)
              .filter(([k]) => !["time", "level", "levelLabel", "msg", "pid", "hostname", "v"].includes(k))
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(" ");
            return (
              <div key={i} className="flex gap-2 leading-5">
                <span className="text-[hsl(var(--muted-foreground))] shrink-0">{ts}</span>
                <span className={`shrink-0 w-10 ${LEVEL_COLORS[e.levelLabel] ?? "text-[hsl(var(--foreground))]"}`}>
                  {e.levelLabel.toUpperCase().slice(0, 4)}
                </span>
                <span className="text-[hsl(var(--foreground))]">{e.msg}</span>
                {extra && <span className="text-[hsl(var(--muted-foreground))] ml-1">{extra}</span>}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function DebugTab({ creds }: { creds: string }) {
  const [cleanupResult, setCleanupResult] = useState<null | { pollsProcessed: number; totalVoteBoxesDeleted: number; totalMbrRecoveredAlgo: number }>(null);

  const cleanupMutation = useMutation({
    mutationFn: () =>
      apiFetch("/admin/ops/trigger-cleanup", creds, { method: "POST", body: "{}" }),
    onSuccess: (data) => setCleanupResult(data as typeof cleanupResult),
  });

  return (
    <div className="space-y-6">
      <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Debug Tools</h2>

      <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 space-y-4">
        <div>
          <div className="font-mono font-semibold text-[hsl(var(--foreground))] mb-1">MBR Cleanup</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Scans all expired polls on-chain and deletes vote boxes to recycle locked ALGO back into the BallotBox account.
            The automated job runs every 6 hours. Use this to trigger it manually.
          </p>
          <button
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="px-4 py-2 rounded font-mono text-sm bg-[hsl(var(--primary))] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {cleanupMutation.isPending ? "Running…" : "▶ Run Cleanup Now"}
          </button>
        </div>

        {cleanupMutation.isError && (
          <div className="rounded bg-red-950/40 border border-red-800/50 px-4 py-3 text-red-400 font-mono text-sm">
            Error: {String(cleanupMutation.error)}
          </div>
        )}

        {cleanupResult && (
          <div className="rounded bg-[hsl(var(--muted))]/60 border border-[hsl(var(--border))] px-4 py-3 space-y-1 font-mono text-sm">
            <div className="text-[hsl(var(--foreground))] font-semibold mb-2">✓ Cleanup complete</div>
            <Row label="Polls processed" value={cleanupResult.pollsProcessed} />
            <Row label="Vote boxes deleted" value={cleanupResult.totalVoteBoxesDeleted} />
            <Row label="ALGO recovered" value={`${cleanupResult.totalMbrRecoveredAlgo.toFixed(4)} ALGO`} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 space-y-2">
        <div className="font-mono font-semibold text-[hsl(var(--foreground))] mb-3">Quick Links</div>
        {[
          ["API Health", "/api/healthz"],
          ["On-chain Stats", "/api/stats"],
          ["Waitlist (HTML)", "/api/admin/waitlist"],
        ].map(([label, url]) => (
          <div key={url} className="flex items-center justify-between py-1">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-[hsl(var(--primary))] hover:underline"
            >
              {url} ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-[hsl(var(--muted-foreground))] font-mono text-sm animate-pulse">
      loading…
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 text-red-400 font-mono text-sm">
      Error: {msg}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm font-mono text-[hsl(var(--foreground))]">{value}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[hsl(var(--foreground))]">{children}</span>;
}

function Badge({ children, color }: { children: React.ReactNode; color: "orange" | "blue" | "green" | "gray" | "red" }) {
  const colors = {
    orange: "bg-orange-900/40 text-orange-400 border-orange-800/50",
    blue:   "bg-blue-900/40 text-blue-400 border-blue-800/50",
    green:  "bg-green-900/40 text-green-400 border-green-800/50",
    gray:   "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]",
    red:    "bg-red-900/40 text-red-400 border-red-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono border ${colors[color]}`}>
      {children}
    </span>
  );
}

const TABS = ["overview", "accounts", "logs", "debug"] as const;
type Tab = (typeof TABS)[number];

function Dashboard({ creds, onLogout }: { creds: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <header className="border-b border-[hsl(var(--border))] px-6 py-3 flex items-center gap-6">
        <span className="font-mono font-extrabold text-[hsl(var(--primary))] tracking-tight text-lg">[ AL0 ]</span>
        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">ops console</span>
        <nav className="ml-6 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                tab === t
                  ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="ml-auto text-xs font-mono text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          sign out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === "overview"  && <OverviewTab creds={creds} />}
        {tab === "accounts"  && <AccountsTab creds={creds} />}
        {tab === "logs"      && <LogsTab creds={creds} />}
        {tab === "debug"     && <DebugTab creds={creds} />}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (creds: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const creds = btoa(`${email}:${password}`);
    try {
      const res = await fetch("/api/admin/ops/overview", {
        headers: { Authorization: `Basic ${creds}` },
      });
      if (res.ok) {
        sessionStorage.setItem("al0_ops_creds", creds);
        onLogin(creds);
      } else {
        setError("Invalid credentials");
      }
    } catch {
      setError("Could not reach server");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-mono font-extrabold text-[hsl(var(--primary))] text-3xl tracking-tight mb-1">[ AL0 ]</div>
          <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-widest">ops console</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6">
          <div>
            <label className="block text-xs font-mono text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))] transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-800/40 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded font-mono text-sm font-semibold bg-[hsl(var(--primary))] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Verifying…" : "Access Console"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [creds, setCreds] = useState<string | null>(() => sessionStorage.getItem("al0_ops_creds"));

  function handleLogin(c: string) { setCreds(c); }
  function handleLogout() {
    sessionStorage.removeItem("al0_ops_creds");
    setCreds(null);
  }

  return (
    <QueryClientProvider client={qc}>
      {creds ? <Dashboard creds={creds} onLogout={handleLogout} /> : <LoginScreen onLogin={handleLogin} />}
    </QueryClientProvider>
  );
}

export default App;
