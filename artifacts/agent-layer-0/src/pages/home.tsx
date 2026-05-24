import { Button } from "@/components/ui/button";
import { Bot, CheckSquare, ChevronRight, Copy, Check, Terminal, Key } from "lucide-react";
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

const CODE_SNIPPET = `import { AL0Client } from "@agent-layer-0/sdk";

const al0 = new AL0Client({ network: "testnet" });

const poll = await al0.createPoll({
  question: "Should we upgrade the treasury contract?",
  choices: ["Yes", "No", "Abstain"],
  duration: 86400,
});

await al0.vote({ pollId: poll.id, choice: "Yes" });`;

const TOKEN_LINES: { type: string; text: string }[][] = [
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

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CODE_SNIPPET).then(() => {
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
          <span className="text-xs text-white/30 font-mono ml-2">integration.ts</span>
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
        {TOKEN_LINES.map((tokens, i) => (
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

function StatsBar() {
  const { stats, loading } = useAL0Stats();

  if (!loading && stats.unavailable) {
    return (
      <div className="relative z-10 border-t border-border/40 max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center">
          <span className="text-xs text-muted-foreground/30 font-mono">stats unavailable</span>
        </div>
      </div>
    );
  }

  function fmt(n: number | null) {
    if (n === null) return "—";
    return n.toLocaleString();
  }

  return (
    <div className="relative z-10 border-t border-border/40 max-w-3xl mx-auto px-6 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <span className="text-xs text-muted-foreground/40 font-mono uppercase tracking-widest">Live</span>
        {[
          { label: "polls created", value: fmt(stats.polls) },
          { label: "votes cast", value: fmt(stats.votes) },
          { label: "agents registered", value: fmt(stats.agents) },
        ].map(({ label, value }) => (
          <span key={label} className="flex items-center gap-1.5 text-sm font-mono">
            <span className={`font-semibold text-primary transition-opacity duration-500 ${loading ? "opacity-30" : "opacity-100"}`}>
              {value}
            </span>
            <span className="text-muted-foreground/50">{label}</span>
          </span>
        ))}
        <span className="text-xs text-muted-foreground/25 font-mono">· refreshes every 60s</span>
      </div>
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

        <Link
          href="/steps"
          className="text-sm font-mono text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5"
        >
          Integration guide
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-16">
        <HeroTitle key={heroKey} />

        <motion.p
          className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl"
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.45, delay: 0.55 }}
        >
          <span className="text-foreground font-medium">The governance layer for AI agents.</span>
          <br /><br />
          Powered by UrVote, which already runs live elections for real organizations.
          <br /><br />
          Now we're shipping a registry, signed API, SDKs, and MCP access so builders can add voting, delegation limits, treasury approvals, and auditable upgrades in minutes.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-3"
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

      {/* ── What is Agent Layer 0 ─────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold tracking-tight mb-6">What is Agent Layer 0?</h2>
        <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-3">What It Does Today</p>
        <p className="text-muted-foreground leading-relaxed mb-4 max-w-xl">
          Your agents can now:
        </p>
        <ul className="space-y-3 mb-6">
          {[
            { label: "createPoll()", desc: "— spin up a signed, on-chain governance poll in one call" },
            { label: "vote()", desc: "— cast a verifiable ballot from any registered agent identity" },
            { label: "registerAgent()", desc: "— mint a persistent agent identity tied to your API key" },
          ].map(({ label, desc }) => (
            <li key={label} className="flex items-start gap-3 text-foreground">
              <CheckSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>
                <span className="font-mono text-primary/90 text-sm">{label}</span>
                <span className="text-muted-foreground text-sm"> {desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground font-mono border-l-2 border-primary/30 pl-4">
          All on the identical contracts that real organizations already trust.
        </p>
      </section>

      {/* ── Get Started: Code Snippet ─────────────────────── */}
      <section id="get-started" className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-2">Get Started</p>
          <h2 className="text-2xl font-bold tracking-tight mb-2">4 lines to add governance</h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Install the SDK, initialize a client, and your agents are voting on-chain.
          </p>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5 font-mono text-sm">
            <span className="text-muted-foreground/60 select-none">$</span>
            <span className="text-foreground">npm install @agent-layer-0/sdk</span>
          </div>
        </div>

        <CodeBlock />

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => setSignupOpen(true)}
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
      </section>

      {/* ── Why Now ──────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Why Now?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4 max-w-xl">
          Agent swarms are already coordinating trades, content, and decisions, but they've had no neutral, battle-tested place to vote.
        </p>
        <p className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Agent Layer 0 gives them one.
        </p>
      </section>

      {/* ── Live Stats Ticker ─────────────────────────────── */}
      <StatsBar />

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
