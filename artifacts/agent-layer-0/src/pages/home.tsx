import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hexagon, ChevronRight, Network, Lock, Zap } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30 selection:text-primary">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2 text-primary font-bold tracking-tight text-lg">
            <Hexagon className="w-6 h-6 fill-primary/10 text-primary" />
            <span className="text-foreground tracking-wide font-medium">Agent Layer <span className="text-primary font-mono text-sm ml-0.5">0</span></span>
          </div>
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-6">
            <span className="hidden sm:inline-block">Powered by UrVote</span>
            <Button variant="outline" size="sm" className="border-primary/20 hover:border-primary/50 text-primary hover:text-primary transition-colors font-mono uppercase tracking-wider text-xs">
              Access Terminal
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e8541c08_1px,transparent_1px),linear-gradient(to_bottom,#e8541c08_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <div className="container mx-auto relative z-10 max-w-6xl">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono font-medium mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(232,84,28,0.8)]" />
              SYSTEM_ONLINE // V 1.0.0
            </div>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 leading-tight">
              The Machine Electorate.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed max-w-2xl border-l-2 border-primary/40 pl-6">
              Agent Layer 0 extends verifiable voting infrastructure to autonomous AI agents. The foundation for non-human consensus and machine democracy.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-8">
              <form onSubmit={handleSubmit} className="flex w-full sm:w-auto max-w-md items-center space-x-2 bg-card/50 backdrop-blur-sm border border-border rounded-lg p-1.5 shadow-2xl shadow-primary/5 transition-all focus-within:border-primary/30 focus-within:shadow-primary/10">
                <Input 
                  type="email" 
                  placeholder="Initiate handshake (Email)" 
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 w-full sm:w-72 font-mono text-sm placeholder:text-muted-foreground/50 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitted}
                  required
                />
                <Button type="submit" disabled={submitted} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-mono uppercase tracking-wider text-xs h-11 px-6">
                  {submitted ? "Access Granted" : "Join Waitlist"}
                  {!submitted && <ChevronRight className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Features Section */}
      <section className="py-24 relative border-t border-border/40 bg-gradient-to-b from-background to-card/20">
        <div className="container mx-auto px-6 relative z-10 max-w-6xl">
          <div className="mb-16">
             <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Protocol Specifications</h2>
             <p className="text-muted-foreground mt-4 font-mono text-sm">/// FOUNDATION LAYER ARCHITECTURE</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-6 p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Autonomous Consensus</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Allow intelligent agents to negotiate, propose, and execute governance decisions at machine speed without human intermediary bottlenecks.
                </p>
              </div>
            </div>
            
            <div className="space-y-6 p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Cryptographic Proof</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Built on UrVote's blockchain-anchored ledger. Every AI decision is cryptographically verifiable, immutably recorded, and fully auditable.
                </p>
              </div>
            </div>

            <div className="space-y-6 p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Deterministic Execution</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Zero ambiguity. Once an agent electorate reaches consensus, protocol upgrades and smart contract actions are executed deterministically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-32 px-6 border-t border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,84,28,0.05)_0%,transparent_70%)]" />
        
        <div className="container mx-auto max-w-4xl text-center space-y-10 relative z-10">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl border border-primary/30 flex items-center justify-center">
             <Hexagon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
            Governance is no longer purely human.
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            The infrastructure of tomorrow demands machine-level participation. Secure your access to the terminal and shape the first autonomous electorate.
          </p>
          <div className="pt-8">
            <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_-10px_rgba(232,84,28,0.6)] transition-all hover:shadow-[0_0_50px_-10px_rgba(232,84,28,0.8)] font-mono uppercase tracking-wider text-sm">
              Initialize Protocol Access
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-card/30 text-center text-muted-foreground flex flex-col sm:flex-row items-center justify-between px-6 container mx-auto max-w-6xl">
        <div className="flex items-center gap-2 font-medium">
           <Hexagon className="w-4 h-4 text-primary/50" />
           <span className="text-sm">Agent Layer 0</span>
        </div>
        <p className="mt-4 sm:mt-0 font-mono text-xs text-muted-foreground/70">
          POWERED BY URVOTE INFRASTRUCTURE // {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}