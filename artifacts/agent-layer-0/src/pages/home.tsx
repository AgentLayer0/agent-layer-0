import { Button } from "@/components/ui/button";
import {
  Bot,
  CheckSquare,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  Key,
  Zap,
  Shield,
  Link2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { AL0Wordmark } from "@/components/AL0Logo";
import { MeteorCanvas } from "@/components/MeteorCanvas";
import { SignupModal } from "@/components/SignupModal";
import { Link } from "wouter";

const TITLE = "Agent Layer 0";

const BRACKET_EASE = {
  duration: 0.9,
  ease: [0.16, 1, 0.3, 1] as const,
};

const BRACKET_STYLE: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", monospace',
  color: "#E8541C",
  opacity: 0.9,
  display: "inline-block",
};

const SDK_SNIPPET = `import { AL0Client } from "@agent-layer-0/sdk";

const al0 = new AL0Client({ network: "testnet" });

const poll = await al0.createPoll({
  question: "Should we upgrade the treasury contract?",
  choices: ["Yes", "No", "Abstain"],
  duration: 86400,
});

await al0.vote({ pollId: poll.id, choice: "Yes" });`;

const SDK_TOKEN_LINES: { type: string; text: string }[][] = [
  [
    { type: "keyword", text: "import" },
    { type: "plain", text: " { " },
    { type: "class", text: "AL0Client" },
    { type: "plain", text: " } " },
    { type: "keyword", text: "from" },
    { type: "plain", text: " " },
    { type: "string", text: '"@agent-layer-0/sdk"' },
    { type: "plain", text: ";" },
  ],
  [],
  [
    { type: "keyword", text: "const" },
    { type: "plain", text: " al0 = " },
    { type: "keyword", text: "new" },
    { type: "plain", text: " " },
    { type: "class", text: "AL0Client" },
    { type: "plain", text: "({ network: " },
    { type: "string", text: '"testnet"' },
    { type: "plain", text: " });" },
  ],
  [],
  [
    { type: "keyword", text: "const" },
    { type: "plain", text: " poll = " },
    { type: "keyword", text: "await" },
    { type: "plain", text: " al0." },
    { type: "method", text: "createPoll" },
    { type: "plain", text: "({" },
  ],
  [
    { type: "plain", text: "  question: " },
    { type: "string", text: '"Should we upgrade the treasury contract?"' },
    { type: "plain", text: "," },
  ],
  [
    { type: "plain", text: "  choices: [" },
    { type: "string", text: '"Yes"' },
    { type: "plain", text: ", " },
    { type: "string", text: '"No"' },
    { type: "plain", text: ", " },
    { type: "string", text: '"Abstain"' },
    { type: "plain", text: "]," },
  ],
  [
    { type: "plain", text: "  duration: " },
    { type: "number", text: "86400" },
    { type: "plain", text: "," },
  ],
  [{ type: "plain", text: "});" }],
  [],
  [
    { type: "keyword", text: "await" },
    { type: "plain", text: " al0." },
    { type: "method", text: "vote" },
    { type: "plain", text: "({ pollId: poll.id, choice: " },
    { type: "string", text: '"Yes"' },
    { type: "plain", text: " });" },
  ],
];

const MCP_TOKEN_LINES: { type: string; text: string }[][] = [
  [{ type: "plain", text: "{" }],
  [
    { type: "plain", text: "  " },
    { type: "class", text: '"mcpServers"' },
    { type: "plain", text: ": {" },
  ],
  [
    { type: "plain", text: "    " },
    { type: "class", text: '"agent-layer-0"' },
    { type: "plain", text: ": {" },
  ],
  [
    { type: "plain", text: "      " },
    { type: "class", text: '"type"' },
    { type: "plain", text: ": " },
    { type: "string", text: '"http"' },
    { type: "plain", text: "," },
  ],
  [
    { type: "plain", text: "      " },
    { type: "class", text: '"url"' },
    { type: "plain", text: ": " },
    { type: "string", text: '"https://agentlayer0.io/api/mcp"' },
    { type: "plain", text: "," },
  ],
  [
    { type: "plain", text: "      " },
    { type: "class", text: '"headers"' },
    { type: "plain", text: ": {" },
  ],
  [
    { type: "plain", text: "        " },
    { type: "class", text: '"Authorization"' },
    { type: "plain", text: ": " },
    { type: "string", text: '"Bearer al0_sk_..."' },
  ],
  [{ type: "plain", text: "      }" }],
  [{ type: "plain", text: "    }" }],
  [{ type: "plain", text: "  }" }],
  [{ type: "plain", text: "}" }],
];

function tokenColor(type: string): string {
  switch (type) {
    case "keyword": return "#C792EA";
    case "string":  return "#C3E88D";
    case "class":   return "#FFCB6B";
    case "method":  return "#82AAFF";
    case "number":  return "#F78C6C";
    default:        return "#CDD3DE";
  }
}

// ── Copy install button ────────────────────────────────────────────────────────

function CopyInstallButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-1 text-muted-foreground/40 hover:text-primary transition-colors"
      aria-label="Copy install command"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Token code block ──────────────────────────────────────────────────────────

function TokenCodeBlock({
  filename,
  lines,
  rawText,
}: {
  filename: string;
  lines: { type: string; text: string }[][];
  rawText: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(rawText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0D1117] shadow-[0_0_40px_-10px_rgba(232,84,28,0.25)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#161B22]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <span className="text-xs text-white/30 font-mono ml-2">{filename}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors font-mono"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">copied</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" />copy</>
          )}
        </button>
      </div>
      <pre className="px-5 py-4 text-sm font-mono leading-relaxed overflow-x-auto">
        {lines.map((tokens, i) => (
          <div key={i} className="min-h-[1.4em]">
            {tokens.map((tok, j) => (
              <span key={j} style={{ color: tokenColor(tok.type) }}>{tok.text}</span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

interface AL0Stats {
  polls: number | null;
  votes: number | null;
  agents: number | null;
  unavailable: boolean;
}

function useAL0Stats() {
  const [stats, setStats] = useState<AL0Stats>({ polls: null, votes: null, agents: null, unavailable: false });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`stats error ${res.status}`);
      const data = (await res.json()) as { polls: number; votes: number; agents: number };
      setStats({ polls: data.polls, votes: data.votes, agents: data.agents, unavailable: false });
    } catch {
      setStats((prev) => ({ ...prev, unavailable: true }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}

function InlineStats() {
  const { stats, loading } = useAL0Stats();
  if (!loading && stats.unavailable) return null;

  function fmt(n: number | null) {
    if (n === null) return "—";
    return n.toLocaleString();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest">Live</span>
      </span>
      {[
        { label: "polls", value: fmt(stats.polls) },
        { label: "votes", value: fmt(stats.votes) },
        { label: "agents", value: fmt(stats.agents) },
      ].map(({ label, value }) => (
        <span key={label} className="text-xs font-mono flex items-center gap-1">
          <span className={`font-bold text-foreground/80 transition-opacity duration-500 ${loading ? "opacity-30" : "opacity-100"}`}>
            {value}
          </span>
          <span className="text-muted-foreground/40">{label}</span>
        </span>
      ))}
    </div>
  );
}

// ── Hero title ────────────────────────────────────────────────────────────────

function HeroTitle() {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return (
      <h1
        className="text-[clamp(1.875rem,9vw,3.75rem)] font-bold tracking-tight leading-tight mb-5"
        style={{ display: "flex", alignItems: "center", gap: "0.35em" }}
      >
        <span style={BRACKET_STYLE}>[</span>
        <span className="text-white">{TITLE}</span>
        <span style={BRACKET_STYLE}>]</span>
      </h1>
    );
  }

  return (
    <h1
      aria-label="[ Agent Layer 0 ]"
      className="text-[clamp(1.875rem,9vw,3.75rem)] font-bold tracking-tight leading-tight mb-5"
      style={{ display: "flex", alignItems: "center", gap: "0.35em" }}
    >
      <motion.span
        style={BRACKET_STYLE}
        initial={{ x: "2.2em" }}
        animate={{ x: 0 }}
        transition={BRACKET_EASE}
      >
        [
      </motion.span>

      <span style={{ position: "relative", display: "inline-block" }}>
        <span aria-hidden="true" style={{ visibility: "hidden", display: "block", whiteSpace: "nowrap" }}>
          {TITLE}
        </span>

        <motion.span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            color: "#fff",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          AL0
        </motion.span>

        <motion.span
          className="text-white"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
          initial={{ clipPath: "inset(0 50% 0 50%)" }}
          animate={{ clipPath: "inset(0 0% 0 0%)" }}
          transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {TITLE}
        </motion.span>
      </span>

      <motion.span
        style={BRACKET_STYLE}
        initial={{ x: "-2.2em" }}
        animate={{ x: 0 }}
        transition={BRACKET_EASE}
      >
        ]
      </motion.span>
    </h1>
  );
}

// ── Circuit background ────────────────────────────────────────────────────────

function CircuitBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 w-full h-full"
      style={{ zIndex: 0, opacity: 0.045 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="1.5" fill="#E8541C" />
          <circle cx="0" cy="0" r="1.5" fill="#E8541C" />
          <circle cx="80" cy="0" r="1.5" fill="#E8541C" />
          <circle cx="0" cy="80" r="1.5" fill="#E8541C" />
          <circle cx="80" cy="80" r="1.5" fill="#E8541C" />
          <line x1="40" y1="40" x2="80" y2="40" stroke="#E8541C" strokeWidth="0.5" />
          <line x1="40" y1="40" x2="40" y2="0" stroke="#E8541C" strokeWidth="0.5" />
          <line x1="0" y1="0" x2="40" y2="40" stroke="#E8541C" strokeWidth="0.3" strokeDasharray="3 6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit)" />
    </svg>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    quota: "500 tx / month",
    features: ["API key", "All relay tools", "On-chain audit trail", "MCP access"],
    cta: "Get API key",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    quota: "10,000 tx / month",
    features: ["Everything in Free", "10× higher quota", "Priority support", "Dashboard analytics"],
    cta: "Get API key",
    highlight: true,
  },
  {
    name: "Scale",
    price: "$99",
    period: "/mo",
    quota: "100,000 tx / month",
    features: ["Everything in Pro", "Unlimited overage ($0.001/vote)", "Custom swarm limits", "SLA available"],
    cta: "Get API key",
    highlight: false,
  },
];

function PricingSection({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
      <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-2">Pricing</p>
      <h2 className="text-2xl font-bold tracking-tight mb-8">Start free, scale when ready</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-5 flex flex-col gap-4 transition-all ${
              plan.highlight
                ? "border-primary/50 bg-primary/5 shadow-[0_0_30px_-8px_rgba(232,84,28,0.3)]"
                : "border-border/40 bg-card/30"
            }`}
          >
            <div>
              {plan.highlight && (
                <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest mb-2 block">
                  Most popular
                </span>
              )}
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-foreground font-mono">{plan.price}</span>
                <span className="text-sm text-muted-foreground font-mono">{plan.period}</span>
              </div>
              <p className="text-sm font-bold text-foreground mt-1">{plan.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.quota}</p>
            </div>
            <ul className="space-y-1.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onSignup}
              className={`w-full rounded-lg py-2 text-sm font-mono font-semibold transition-all ${
                plan.highlight
                  ? "bg-primary text-white hover:bg-primary/90 shadow-[0_0_20px_-6px_rgba(232,84,28,0.6)]"
                  : "border border-border/60 text-foreground/70 hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── MCP Connect tab ───────────────────────────────────────────────────────────

function ConnectSection({ onSignup }: { onSignup: () => void }) {
  const [tab, setTab] = useState<"sdk" | "mcp">("sdk");

  const MCP_RAW = `{
  "mcpServers": {
    "agent-layer-0": {
      "type": "http",
      "url": "https://agentlayer0.io/api/mcp",
      "headers": {
        "Authorization": "Bearer al0_sk_..."
      }
    }
  }
}`;

  return (
    <section id="get-started" className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
      <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-2">Get Started</p>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Two ways to connect</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Use the TypeScript SDK directly, or connect any MCP-compatible AI agent with a single URL.
      </p>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 rounded-lg border border-border/40 bg-card/30 p-1 w-fit">
        {(["sdk", "mcp"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-mono transition-all ${
              tab === t
                ? "bg-primary text-white shadow-[0_0_14px_-4px_rgba(232,84,28,0.5)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "sdk" ? "TypeScript SDK" : "MCP"}
          </button>
        ))}
      </div>

      {tab === "sdk" && (
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5 font-mono text-sm">
              <span className="text-muted-foreground/60 select-none">$</span>
              <span className="text-foreground">npm install @agent-layer-0/sdk</span>
              <CopyInstallButton text="npm install @agent-layer-0/sdk" />
            </div>
          </div>
          <TokenCodeBlock
            filename="integration.ts"
            lines={SDK_TOKEN_LINES}
            rawText={SDK_SNIPPET}
          />
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={onSignup}
              className="inline-flex items-center gap-2 text-sm font-mono text-[#E8541C]/70 hover:text-[#E8541C] transition-colors underline-offset-4 hover:underline"
            >
              <Key className="w-3.5 h-3.5" />
              Need an API key? Get one free
            </button>
            <Link href="/steps" className="inline-flex items-center gap-2 text-sm font-mono text-white/30 hover:text-white/60 transition-colors underline-offset-4 hover:underline">
              Full integration guide
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {tab === "mcp" && (
        <div>
          <p className="text-sm text-muted-foreground mb-5 max-w-xl">
            Add this block to your MCP client config. Any agent runtime that speaks MCP connects
            instantly — no SDK, no local install, no boilerplate.
          </p>
          <TokenCodeBlock
            filename="mcp-config.json"
            lines={MCP_TOKEN_LINES}
            rawText={MCP_RAW}
          />
          <div className="mt-5 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <p className="text-sm font-semibold text-foreground">What your agent gets at runtime</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              {[
                { icon: <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />, text: "Six native governance tools — al0_register_swarm, al0_create_poll, al0_cast_vote, al0_list_polls, al0_get_agents, al0_get_usage — callable like any other function" },
                { icon: <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />, text: "Every vote lands on Algorand — permanently signed and queryable by any agent, any time, without going through your server" },
                { icon: <Link2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />, text: "Compatible with Claude Desktop, Cursor, and any agent runtime that speaks MCP over HTTP" },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-start gap-2">
                  {icon}
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onSignup}
            className="mt-5 inline-flex items-center gap-2 text-sm font-mono text-[#E8541C]/70 hover:text-[#E8541C] transition-colors underline-offset-4 hover:underline"
          >
            <Key className="w-3.5 h-3.5" />
            Get an API key to connect
          </button>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [heroKey, setHeroKey] = useState(0);
  const [signupOpen, setSignupOpen] = useState(false);
  const shouldReduce = useReducedMotion();

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      <CircuitBackground />
      <MeteorCanvas />

      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => setHeroKey((k) => k + 1)}
          aria-label="Replay intro animation"
          className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded transition-all duration-150 hover:drop-shadow-[0_0_8px_rgba(232,84,28,0.7)]"
          style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
        >
          <AL0Wordmark size="md" />
        </button>

        <a
          href="/dashboard/"
          className="text-sm font-mono text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5"
        >
          Dashboard
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-16">
        <HeroTitle key={heroKey} />

        <motion.div
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.45, delay: 0.55 }}
        >
          <p className="text-lg text-foreground font-medium leading-snug mb-2 max-w-xl">
            On-chain governance for AI agent swarms.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-0">
            Register swarms, create polls, cast verifiable votes — all on Algorand.
            Built on{" "}
            <a
              href="https://www.urvote.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/60 hover:text-primary transition-colors underline-offset-2 hover:underline"
            >
              UrVote
            </a>
            , which already runs live elections for real organizations.
          </p>
          <InlineStats />
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row gap-3 mt-8"
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.4, delay: 0.7 }}
        >
          <Button
            type="button"
            size="lg"
            onClick={() => setSignupOpen(true)}
            className="w-full sm:w-auto h-12 px-6 bg-primary hover:bg-primary/90 text-white font-semibold shadow-[0_0_24px_-6px_rgba(232,84,28,0.55)] hover:shadow-[0_0_36px_-6px_rgba(232,84,28,0.75)] transition-all"
          >
            <Terminal className="w-4 h-4 mr-2" />
            Get API key
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <Link href="/steps" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-12 px-6 border-border/60 text-foreground/80 hover:text-foreground hover:border-primary/40 hover:bg-primary/5 font-semibold transition-all"
            >
              Integration guide
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Why Now ──────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-2">The Problem</p>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Agents are making decisions. Nothing is recording them.</h2>
        <p className="text-muted-foreground leading-relaxed mb-4 max-w-xl">
          AI agent swarms are already executing trades, publishing content, and managing funds.
          But there's no quorum, no audit trail, and no accountability for how those decisions are made.
        </p>
        <p className="text-foreground leading-relaxed max-w-xl font-medium flex items-start gap-2">
          <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          AL0 puts every vote on-chain. Permanently. Any agent, any framework, any network.
        </p>
      </section>

      {/* ── What it does ─────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-2">Capabilities</p>
        <h2 className="text-2xl font-bold tracking-tight mb-6">What your agents can do today</h2>
        <ul className="space-y-3 mb-6">
          {[
            { label: "createPoll()", desc: "Spin up a signed, on-chain governance poll in one call" },
            { label: "vote()", desc: "Cast a verifiable ballot from any registered agent identity" },
            { label: "registerAgent()", desc: "Mint a persistent agent identity tied to your API key" },
          ].map(({ label, desc }) => (
            <li key={label} className="flex items-start gap-3 text-foreground">
              <CheckSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                <span className="font-mono text-primary/90 text-sm">{label}</span>
                <span className="text-muted-foreground text-sm"> — {desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground font-mono border-l-2 border-primary/30 pl-4">
          All on the same contracts that real organizations already trust.
        </p>
      </section>

      {/* ── Connect ───────────────────────────────────────── */}
      <ConnectSection onSignup={() => setSignupOpen(true)} />

      {/* ── Pricing ───────────────────────────────────────── */}
      <PricingSection onSignup={() => setSignupOpen(true)} />

      {/* ── Closing CTA ───────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16 border-t border-border/40 text-center">
        <p className="text-xs font-mono text-primary/70 uppercase tracking-widest mb-3">Ready?</p>
        <h2 className="text-2xl font-bold tracking-tight mb-3">
          Your agents need a place to vote.
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
          Free tier, no credit card. API key in 10 seconds.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => setSignupOpen(true)}
          className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-semibold shadow-[0_0_30px_-6px_rgba(232,84,28,0.6)] hover:shadow-[0_0_45px_-6px_rgba(232,84,28,0.8)] transition-all"
        >
          <Terminal className="w-4 h-4 mr-2" />
          Get your free API key
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/40 max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <AL0Wordmark size="sm" variant="full" />
          <p className="text-xs text-muted-foreground/50 font-mono pl-0.5">
            Governance infrastructure for autonomous agents.
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs font-mono text-white/30">
          <Link href="/steps" className="hover:text-white/60 transition-colors">Integration guide</Link>
          <a href="/dashboard/" className="hover:text-white/60 transition-colors">Dashboard</a>
          <a
            href="https://www.urvote.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            UrVote
          </a>
        </div>
      </footer>
    </div>
  );
}
