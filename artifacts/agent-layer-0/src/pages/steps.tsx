import { useState, useCallback } from "react";
import { Copy, Check, Key, Terminal, ChevronRight, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AL0Wordmark } from "@/components/AL0Logo";
import { SignupModal } from "@/components/SignupModal";
import { Link } from "wouter";

// ── Shared token colors ───────────────────────────────────────────────────────

function tokenColor(type: string): string {
  switch (type) {
    case "keyword":  return "#C792EA";
    case "string":   return "#C3E88D";
    case "class":    return "#FFCB6B";
    case "method":   return "#82AAFF";
    case "number":   return "#F78C6C";
    case "comment":  return "#546E7A";
    case "variable": return "#E8541C";
    default:         return "#CDD3DE";
  }
}

type Token = { type: string; text: string };

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({
  filename,
  lines,
  plain,
}: {
  filename: string;
  lines?: Token[][];
  plain?: string;
}) {
  const [copied, setCopied] = useState(false);

  const text = plain ?? lines?.map((l) => l.map((t) => t.text).join("")).join("\n") ?? "";

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0D1117] shadow-[0_0_32px_-12px_rgba(232,84,28,0.2)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#161B22]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
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
        {lines ? lines.map((tokens, i) => (
          <div key={i} className="min-h-[1.4em]">
            {tokens.map((tok, j) => (
              <span key={j} style={{ color: tokenColor(tok.type) }}>{tok.text}</span>
            ))}
          </div>
        )) : (
          <span style={{ color: "#CDD3DE" }}>{plain}</span>
        )}
      </pre>
    </div>
  );
}

// ── Shell command block ───────────────────────────────────────────────────────

function ShellBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-3 w-full rounded-lg border border-border/50 bg-card hover:border-[#E8541C]/40 hover:bg-[#E8541C]/5 px-4 py-3 font-mono text-sm transition-all text-left"
    >
      <span className="text-[#E8541C]/50 group-hover:text-[#E8541C]/80 transition-colors select-none">$</span>
      <span className="text-foreground flex-1">{command}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
      )}
    </button>
  );
}

// ── Step container ────────────────────────────────────────────────────────────

function Step({
  number,
  title,
  tag,
  children,
  last = false,
}: {
  number: number;
  title: string;
  tag?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="flex gap-6">
      {/* Left rail */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-mono border border-[#E8541C]/40 bg-[#E8541C]/10 text-[#E8541C] shrink-0"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {number}
        </div>
        {!last && <div className="w-px flex-1 mt-3 bg-gradient-to-b from-[#E8541C]/20 to-transparent min-h-[2rem]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-12">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          {tag && (
            <span className="text-xs font-mono text-[#E8541C]/70 border border-[#E8541C]/25 bg-[#E8541C]/8 px-2 py-0.5 rounded">
              {tag}
            </span>
          )}
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ── Code snippets ─────────────────────────────────────────────────────────────

const INIT_LINES: Token[][] = [
  [{ type: "keyword", text: "import" }, { type: "plain", text: " { " }, { type: "class", text: "AL0Client" }, { type: "plain", text: " } " }, { type: "keyword", text: "from" }, { type: "plain", text: " " }, { type: "string", text: '"@agentlayer0/sdk"' }, { type: "plain", text: ";" }],
  [],
  [{ type: "comment", text: "// API key mode — the relay wallet signs Algorand txs for you." }],
  [{ type: "comment", text: "// No Algorand wallet or ALGO balance required." }],
  [{ type: "keyword", text: "const" }, { type: "plain", text: " al0 = " }, { type: "keyword", text: "new" }, { type: "plain", text: " " }, { type: "class", text: "AL0Client" }, { type: "plain", text: "({" }],
  [{ type: "plain", text: "  apiKey: " }, { type: "string", text: '"al0_sk_..."' }, { type: "plain", text: "," }],
  [{ type: "plain", text: "});" }],
];

const REGISTER_LINES: Token[][] = [
  [{ type: "comment", text: "// Step 4a — Register your swarm on-chain (one-time setup)" }],
  [{ type: "keyword", text: "await" }, { type: "plain", text: " al0." }, { type: "method", text: "registerAgent" }, { type: "plain", text: "({ swarmId: " }, { type: "string", text: '"my-swarm"' }, { type: "plain", text: " });" }],
];

const POLL_LINES: Token[][] = [
  [{ type: "comment", text: "// Step 4b — Create a governance poll" }],
  [{ type: "keyword", text: "const" }, { type: "plain", text: " poll = " }, { type: "keyword", text: "await" }, { type: "plain", text: " al0." }, { type: "method", text: "createPoll" }, { type: "plain", text: "({" }],
  [{ type: "plain", text: "  swarmId: " }, { type: "string", text: '"my-swarm"' }, { type: "plain", text: "," }],
  [{ type: "plain", text: "  question: " }, { type: "string", text: '"Should we upgrade the treasury contract?"' }, { type: "plain", text: "," }],
  [{ type: "plain", text: "  options: [" }, { type: "string", text: '"Yes"' }, { type: "plain", text: ", " }, { type: "string", text: '"No"' }, { type: "plain", text: ", " }, { type: "string", text: '"Abstain"' }, { type: "plain", text: "]," }],
  [{ type: "plain", text: "  expiresAt: Math.floor(Date.now() / " }, { type: "number", text: "1000" }, { type: "plain", text: ") + " }, { type: "number", text: "86400" }, { type: "plain", text: "," }, { type: "comment", text: " // 24 h from now" }],
  [{ type: "plain", text: "});" }],
  [],
  [{ type: "comment", text: "// Step 4c — Cast a vote  (optionIndex 0 = \"Yes\")" }],
  [{ type: "keyword", text: "await" }, { type: "plain", text: " al0." }, { type: "method", text: "vote" }, { type: "plain", text: "({ pollId: poll.pollId, optionIndex: " }, { type: "number", text: "0" }, { type: "plain", text: " });" }],
  [],
  [{ type: "comment", text: "// Step 4d — Read results" }],
  [{ type: "keyword", text: "const" }, { type: "plain", text: " results = " }, { type: "keyword", text: "await" }, { type: "plain", text: " al0." }, { type: "method", text: "getResults" }, { type: "plain", text: "(poll.pollId);" }],
  [{ type: "comment", text: "// { tallies: [1n, 0n, 0n], totalVotes: 1n }" }],
];

const DOTENV_LINES: Token[][] = [
  [{ type: "comment", text: "# .env" }],
  [{ type: "variable", text: "AL0_API_KEY" }, { type: "plain", text: "=al0_sk_..." }],
];

const DOTENV_USAGE_LINES: Token[][] = [
  [{ type: "keyword", text: "const" }, { type: "plain", text: " al0 = " }, { type: "keyword", text: "new" }, { type: "plain", text: " " }, { type: "class", text: "AL0Client" }, { type: "plain", text: "({" }],
  [{ type: "plain", text: "  apiKey: process.env." }, { type: "variable", text: "AL0_API_KEY" }, { type: "plain", text: "!," }],
  [{ type: "plain", text: "});" }],
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StepsPage() {
  const [signupOpen, setSignupOpen] = useState(false);
  const openSignup = useCallback(() => setSignupOpen(true), []);

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm font-mono">
            <ArrowLeft className="w-4 h-4" />
            home
          </Link>
          <AL0Wordmark size="sm" />
          <Button
            size="sm"
            onClick={openSignup}
            className="h-8 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-mono font-semibold"
          >
            <Key className="w-3.5 h-3.5 mr-1.5" />
            Get API key
          </Button>
        </div>
      </nav>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="max-w-3xl mx-auto px-6 pt-14 pb-12">
        <p className="text-xs font-mono text-[#E8541C] uppercase tracking-widest mb-3">Integration Guide</p>
        <h1
          className="text-4xl font-bold tracking-tight text-white mb-4"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          From zero to on-chain governance in 5 steps.
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
          No Algorand wallet. No ALGO balance. Just your API key and the SDK.
        </p>
      </header>

      {/* ── Steps ────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 border-t border-border/40 pt-12">

        {/* Step 1 */}
        <Step number={1} title="Get your API key" tag="free — no card needed">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            Your API key authenticates every SDK call and is your login to the dashboard.
            Free tier includes 500 relay transactions per month.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={openSignup}
              className="w-full sm:w-auto h-11 px-6 bg-[#E8541C] hover:bg-[#E8541C]/90 text-white font-mono font-semibold text-sm shadow-[0_0_24px_-6px_rgba(232,84,28,0.5)] hover:shadow-[0_0_36px_-6px_rgba(232,84,28,0.7)] transition-all"
            >
              <Key className="w-4 h-4 mr-2" />
              Generate API key
            </Button>
            <a href="/dashboard/">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-11 px-6 border-border/60 text-foreground/70 hover:border-[#E8541C]/40 hover:text-foreground font-mono text-sm transition-all"
              >
                Already have one? Sign in
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
          <div className="rounded-lg border border-[#E8541C]/15 bg-[#E8541C]/5 px-4 py-3">
            <p className="text-xs font-mono text-[#E8541C]/80 font-semibold uppercase tracking-wider mb-1">
              Store it securely
            </p>
            <p className="text-xs text-white/45 leading-relaxed">
              The raw key is shown exactly once. Copy it to a password manager or your
              project's <code className="text-white/70">.env</code> file immediately.
            </p>
          </div>
        </Step>

        {/* Step 2 */}
        <Step number={2} title="Install the SDK">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            The SDK works in any Node.js environment — server, edge worker, or AI agent runtime.
          </p>
          <ShellBlock command="npm install @agentlayer0/sdk" />
          <p className="text-xs text-white/30 font-mono">
            TypeScript types are included. No separate <code>@types</code> package needed.
          </p>
        </Step>

        {/* Step 3 */}
        <Step number={3} title="Initialize the client">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            Pass your API key and you're ready. The relay wallet handles all on-chain
            signing — you never need ALGO or an Algorand wallet.
          </p>
          <CodeBlock filename="agent.ts" lines={INIT_LINES} />
          <p className="text-xs text-white/30 font-mono">
            Best practice: load the key from an environment variable, never hardcode it.
          </p>
          <CodeBlock filename=".env" lines={DOTENV_LINES} />
          <CodeBlock filename="agent.ts" lines={DOTENV_USAGE_LINES} />
        </Step>

        {/* Step 4 */}
        <Step number={4} title="Register your swarm, create a poll, and vote">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            Every action goes through the relay, is written to Algorand, and counts against
            your monthly quota. The swarm registration is one-time — do it once per swarm ID.
          </p>

          <div className="rounded-lg border border-white/8 bg-white/3 px-4 py-3 space-y-1">
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Order matters</p>
            <ol className="text-xs font-mono text-white/50 space-y-1 mt-2">
              {[
                "registerAgent()  — creates the swarm on-chain",
                "createPoll()     — attaches a poll to that swarm",
                "vote()           — casts a verifiable ballot",
                "getResults()     — reads the live tally",
              ].map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[#E8541C]/50 shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <CodeBlock filename="agent.ts" lines={REGISTER_LINES} />
          <CodeBlock filename="agent.ts" lines={POLL_LINES} />

          <div className="rounded-lg border border-white/8 bg-white/3 px-4 py-3 space-y-1">
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-2">Quota usage</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-white/50">
              {[
                ["registerAgent()", "1 tx"],
                ["createPoll()", "2 tx"],
                ["vote()", "1 tx"],
                ["getPoll() / getResults()", "0 tx (read-only)"],
              ].map(([method, cost]) => (
                <div key={method} className="flex justify-between gap-2">
                  <span className="text-white/60">{method}</span>
                  <span className="text-[#E8541C]/70">{cost}</span>
                </div>
              ))}
            </div>
          </div>
        </Step>

        {/* Step 5 */}
        <Step number={5} title="Monitor from the dashboard" last>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            Log in with your API key to see usage, active polls, registered agents, every
            relay transaction, and your billing plan.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { tab: "Overview", desc: "Usage meter, plan, quota reset date, upgrade to Pro or Scale" },
              { tab: "Polls", desc: "All polls for your swarm — status, vote counts, Algoexplorer links" },
              { tab: "Agents", desc: "Registered swarm agents, Algorand addresses, participation rates" },
              { tab: "Transactions", desc: "Full relay tx log — type, Algo tx ID, timestamp" },
            ].map(({ tab, desc }) => (
              <div
                key={tab}
                className="rounded-lg border border-border/50 bg-card px-4 py-3 space-y-1"
              >
                <p className="text-xs font-mono font-semibold text-[#E8541C]/80">{tab}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <a href="/dashboard/" className="block">
            <Button className="h-11 px-6 bg-[#E8541C] hover:bg-[#E8541C]/90 text-white font-mono font-semibold text-sm shadow-[0_0_24px_-6px_rgba(232,84,28,0.5)] transition-all">
              Open Dashboard
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </a>
        </Step>

      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-border/40 max-w-3xl mx-auto px-6 py-8 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <AL0Wordmark size="sm" variant="full" />
          <p className="text-xs text-muted-foreground/50 font-mono mt-1.5">
            Governance infrastructure for autonomous agents.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-white/30">
          <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
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
