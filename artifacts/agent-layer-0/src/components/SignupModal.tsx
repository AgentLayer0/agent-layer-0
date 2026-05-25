import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Key, Loader2, X } from "lucide-react";

type SignupStep = "form" | "success";

interface SignupResult {
  key: string;
  email: string;
  plan: string;
  quota: number;
}

function CopyableKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="relative rounded-lg border border-[#E8541C]/30 bg-[#0D1117] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 bg-[#161B22]">
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-[#E8541C]/70" />
          <span className="text-xs text-white/40 font-mono">API key</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors font-mono"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">copied</span>
            </>
          ) : (
            <>
              <Key className="w-3.5 h-3.5" />
              copy
            </>
          )}
        </button>
      </div>
      <div className="px-4 py-3">
        <code
          className="text-sm font-mono text-[#E8541C] break-all leading-relaxed"
          style={{ wordBreak: "break-all" }}
        >
          {value}
        </code>
      </div>
    </div>
  );
}

export function SignupModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as {
        key?: string;
        email?: string;
        plan?: string;
        quota?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Signup failed. Please try again.");
        return;
      }
      setResult({ key: data.key!, email: data.email!, plan: data.plan ?? "free", quota: data.quota ?? 500 });
      setStep("success");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d10] shadow-[0_0_60px_-12px_rgba(232,84,28,0.35)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <p className="text-xs font-mono text-[#E8541C] uppercase tracking-widest mb-1">[ AL0 ]</p>
            <h2
              id="signup-title"
              className="text-lg font-bold text-white tracking-tight"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {step === "form" ? "Get your API key" : "Key issued"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          {step === "form" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-white/50 leading-relaxed">
                Free tier: <span className="text-white/80 font-mono">500 tx / month.</span>{" "}
                No credit card needed to start.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-mono text-white/40 uppercase tracking-widest"
                >
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-[#161B22] px-4 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#E8541C]/60 focus:ring-1 focus:ring-[#E8541C]/30 transition-colors"
                />
              </div>
              {error && (
                <p className="text-sm font-mono text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-4 py-2.5">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#E8541C] hover:bg-[#E8541C]/90 text-white font-semibold font-mono text-sm shadow-[0_0_24px_-6px_rgba(232,84,28,0.6)] hover:shadow-[0_0_36px_-6px_rgba(232,84,28,0.8)] transition-all disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating key...</>
                ) : (
                  <><Key className="w-4 h-4 mr-2" />Generate API key</>
                )}
              </Button>
              <p className="text-xs text-white/25 font-mono text-center leading-relaxed">
                One key per email. Your key is hashed on our end — store it now.
              </p>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
                <Check className="w-4 h-4" />
                Key created for {result!.email}
              </div>
              <CopyableKey value={result!.key} />
              <div className="rounded-lg border border-[#E8541C]/15 bg-[#E8541C]/5 px-4 py-3 space-y-1">
                <p className="text-xs font-mono text-[#E8541C]/80 font-semibold uppercase tracking-wider">
                  Save this now
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  This key will not be shown again. Copy it to a password manager or your .env file before closing.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs text-white/30 font-mono uppercase tracking-widest">Next steps</p>
                <div className="space-y-2 text-sm font-mono text-white/50">
                  <div className="flex items-start gap-2">
                    <span className="text-[#E8541C]/60 shrink-0">1.</span>
                    <span className="text-white/70">npm install @agentlayer0/sdk</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#E8541C]/60 shrink-0">2.</span>
                    <span>Paste your key into the SDK client or dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#E8541C]/60 shrink-0">3.</span>
                    <span>
                      Free tier:{" "}
                      <span className="text-white/70">{result!.quota.toLocaleString()} tx/month</span>
                      {" "}— upgrade anytime from the dashboard
                    </span>
                  </div>
                </div>
              </div>
              <a href="/steps">
                <Button className="w-full h-11 bg-[#E8541C] hover:bg-[#E8541C]/90 text-white font-semibold font-mono text-sm transition-all">
                  See integration steps
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-xs text-white/25 hover:text-white/50 font-mono transition-colors"
              >
                close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
