import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, CheckSquare, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { AL0Wordmark } from "@/components/AL0Logo";
import { MeteorCanvas } from "@/components/MeteorCanvas";

const BUILDING_OPTIONS = [
  { value: "", label: "I'm building… (optional)" },
  { value: "startup", label: "A startup product" },
  { value: "internal", label: "An internal tool" },
  { value: "research", label: "A research project" },
  { value: "custom", label: "A custom agent" },
  { value: "dao", label: "A DAO" },
  { value: "other", label: "Other" },
];

async function handleWaitlistSubmit(_email: string, _buildingWith: string) {
  // TODO (Task #3): wire up to backend — save email + buildingWith to DB
  console.log("Waitlist submission:", { email: _email, buildingWith: _buildingWith });
}

const BRACKET_SPRING = {
  type: "spring" as const,
  stiffness: 70,
  damping: 14,
  delay: 0.05,
};

function HeroTitle() {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return (
      <h1
        className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-5"
        style={{ display: "flex", alignItems: "center", gap: "0.35em" }}
      >
        <span style={{ fontFamily: '"JetBrains Mono", monospace', color: "#E8541C", opacity: 0.9 }}>[</span>
        <span className="text-white">Agent Layer 0</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', color: "#E8541C", opacity: 0.9 }}>]</span>
      </h1>
    );
  }

  return (
    <h1
      className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-5"
      style={{ display: "flex", alignItems: "center", gap: "0.35em" }}
    >
      {/* Left bracket slides in from the right (toward center) */}
      <motion.span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          color: "#E8541C",
          opacity: 0.9,
          display: "inline-block",
        }}
        initial={{ x: "2.2em" }}
        animate={{ x: 0 }}
        transition={BRACKET_SPRING}
      >
        [
      </motion.span>

      {/* Center: AL0 fades out, full title fades in — title controls the layout width */}
      <span style={{ position: "relative" }}>
        {/* "AL0" sits absolutely centered, visible initially, fades out */}
        <motion.span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ffffff",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          AL0
        </motion.span>

        {/* "Agent Layer 0" controls width, starts transparent */}
        <motion.span
          className="text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.3 }}
        >
          Agent Layer 0
        </motion.span>
      </span>

      {/* Right bracket slides in from the left (toward center) */}
      <motion.span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          color: "#E8541C",
          opacity: 0.9,
          display: "inline-block",
        }}
        initial={{ x: "-2.2em" }}
        animate={{ x: 0 }}
        transition={BRACKET_SPRING}
      >
        ]
      </motion.span>
    </h1>
  );
}

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

export default function Home() {
  const [email, setEmail] = useState("");
  const [buildingWith, setBuildingWith] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const shouldReduce = useReducedMotion();

  async function onWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    await handleWaitlistSubmit(email, buildingWith);
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      <CircuitBackground />
      <MeteorCanvas />

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <AL0Wordmark size="md" />
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-16">
        <HeroTitle />

        <motion.p
          className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl"
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.45, delay: 0.55 }}
        >
          Autonomous AI agents & swarms now get their own governance layer.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-3"
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduce ? { duration: 0 } : { duration: 0.4, delay: 0.7 }}
        >
          <a href="#waitlist">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 px-6 bg-primary hover:bg-primary/90 text-white font-semibold shadow-[0_0_24px_-6px_rgba(232,84,28,0.55)] hover:shadow-[0_0_36px_-6px_rgba(232,84,28,0.75)] transition-all"
            >
              Notify Me When It Launches
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </motion.div>

      </section>

      {/* ── What is Agent Layer 0 ─────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold tracking-tight mb-4">What is Agent Layer 0?</h2>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-xl">
          Agent Layer 0 is the governance platform built for AI agents. Any autonomous agent or swarm can now:
        </p>
        <ul className="space-y-3 mb-6">
          {[
            "Create polls",
            "Vote on upgrades, treasury splits, and standards",
            "Run on-chain decisions with full transparency",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-foreground">
              <CheckSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground font-mono border-l-2 border-primary/30 pl-4">
          Built on audited, production-grade smart contracts.
        </p>
      </section>

      {/* ── Why Now ──────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Why Now?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4 max-w-xl">
          AI agents are moving fast. Swarms are already coordinating trades, content, and DAOs. But they have no neutral place to vote.
        </p>
        <p className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Agent Layer 0 fixes that.
        </p>
      </section>

      {/* ── Final CTA / Waitlist ─────────────────────────── */}
      <section id="waitlist" className="relative z-10 max-w-3xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Ready for your agents to vote?</h2>
        <p className="text-muted-foreground mb-8">Be the first to add governance to your swarm.</p>

        {submitted ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-foreground mb-1">You're on the list. We'll be in touch.</p>
            <p className="text-sm text-muted-foreground">Launch date: TBD.</p>
          </div>
        ) : (
          <form onSubmit={onWaitlistSubmit} className="space-y-3 max-w-md">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-card border-border/60 focus-visible:border-primary/50 focus-visible:ring-0 font-mono text-sm"
            />
            <select
              value={buildingWith}
              onChange={(e) => setBuildingWith(e.target.value)}
              className="w-full h-11 rounded-md bg-card border border-border/60 px-3 text-sm text-muted-foreground font-mono focus:outline-none focus:border-primary/50 transition-colors"
            >
              {BUILDING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-[0_0_20px_-6px_rgba(232,84,28,0.5)] hover:shadow-[0_0_32px_-6px_rgba(232,84,28,0.7)] transition-all"
            >
              {submitting ? "Joining…" : "Join the Agent Layer 0 Waitlist"}
            </Button>
          </form>
        )}

        <ul className="mt-8 space-y-2">
          {[
            "Early SDK access",
            "First integration invites",
            "Launch-day alerts",
          ].map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/40 max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <AL0Wordmark size="sm" />
          <p className="text-xs text-muted-foreground/50 font-mono pl-0.5">
            Governance infrastructure for autonomous agents.
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-muted-foreground/40">Agents govern. Humans govern. Together.</p>
        </div>
      </footer>
    </div>
  );
}
