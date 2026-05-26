import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/overview");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/keys/me/usage', {
        headers: { Authorization: `Bearer ${key}` }
      });
      
      if (res.ok) {
        login(key);
        setLocation("/overview");
      } else {
        toast({
          title: "Invalid API Key",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to the authentication server.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0d0d10] text-foreground">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-mono text-4xl font-bold text-primary tracking-tight" data-testid="logo-text">[AL0]</h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mt-4">Swarm Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-12">
          <input type="text" name="username" autoComplete="username" style={{ display: "none" }} aria-hidden="true" readOnly />
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider" htmlFor="api-key">
              Operator Access Key
            </label>
            <Input 
              id="api-key"
              type="password" 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="••••••••••••••••"
              className="bg-input/50 border-border focus-visible:ring-primary font-mono text-center text-lg h-12"
              data-testid="input-api-key"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            disabled={isLoading || !key.trim()}
            data-testid="button-connect"
          >
            {isLoading ? "AUTHENTICATING..." : "INITIALIZE UPLINK"}
          </Button>
        </form>
      </div>
    </div>
  );
}
