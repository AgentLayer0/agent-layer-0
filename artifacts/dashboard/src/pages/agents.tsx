import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGovernanceAgents,
  useUserContext,
  getRegistryAppId,
  setRegistryAppId,
  getBallotBoxAppId,
  setBallotBoxAppId,
  getPollFactoryAppId,
  setPollFactoryAppId,
  type GovernanceAgent,
} from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";

const ALGOEXPLORER_APP = "https://testnet.algoexplorer.io/application";
const ALGOEXPLORER_ADDR = "https://testnet.algoexplorer.io/address";

function AgentRow({ agent, index }: { agent: GovernanceAgent; index: number }) {
  const registeredDate = new Date(agent.registered_at * 1000);
  const lastActiveDate = agent.last_active ? new Date(agent.last_active * 1000) : null;
  const pct = agent.participation_rate ?? 0;

  return (
    <Card
      className="bg-card border-card-border hover:border-primary/30 transition-colors"
      data-testid={`agent-row-${index}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">SWARM</span>
              <span className="font-mono text-sm font-bold text-foreground truncate">
                {agent.swarm_id}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>OWNER:</span>
              <a
                href={`${ALGOEXPLORER_ADDR}/${agent.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline truncate"
                data-testid={`link-owner-${index}`}
              >
                {agent.address.slice(0, 10)}…{agent.address.slice(-6)} ↗
              </a>
            </div>
            <div
              className="text-xs font-mono text-muted-foreground"
              title={format(registeredDate, "PPpp")}
            >
              REGISTERED: {format(registeredDate, "MM/dd/yy")} ·{" "}
              {formatDistanceToNow(registeredDate, { addSuffix: true })}
            </div>
          </div>

          <div className="shrink-0 text-right space-y-1">
            <div className="flex items-center justify-end gap-3 text-xs font-mono">
              <span className="text-muted-foreground">
                VOTES:{" "}
                <span className="text-foreground font-bold">{agent.vote_count}</span>
              </span>
              {agent.participation_rate !== null && (
                <span className="text-muted-foreground">
                  PART:{" "}
                  <span
                    className={
                      pct >= 80
                        ? "text-green-400 font-bold"
                        : pct >= 50
                        ? "text-primary font-bold"
                        : "text-foreground"
                    }
                  >
                    {pct}%
                  </span>
                </span>
              )}
            </div>
            {agent.participation_rate !== null && (
              <div className="h-1 bg-muted rounded-full overflow-hidden w-32 ml-auto">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <div className="text-xs font-mono text-muted-foreground">
              {lastActiveDate ? (
                <span title={format(lastActiveDate, "PPpp")}>
                  LAST ACTIVE: {formatDistanceToNow(lastActiveDate, { addSuffix: true })}
                </span>
              ) : (
                <span className="text-muted-foreground/40">NO VOTES YET</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const { data: context } = useUserContext();

  const [registryInput, setRegistryInput] = useState(
    () => String(getRegistryAppId() ?? "")
  );
  const [ballotBoxInput, setBallotBoxInput] = useState(
    () => String(getBallotBoxAppId() ?? "")
  );
  const [pollFactoryInput, setPollFactoryInput] = useState(
    () => String(getPollFactoryAppId() ?? "")
  );
  const [registryId, setRegistryId] = useState<number | null>(getRegistryAppId);
  const [ballotBoxId, setBallotBoxIdState] = useState<number | null>(getBallotBoxAppId);
  const [pollFactoryId, setPollFactoryIdState] = useState<number | null>(getPollFactoryAppId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!context) return;
    const { agentRegistryAppId, pollFactoryAppId, ballotBoxAppId } = context.appIds;
    if (agentRegistryAppId > 0 && !getRegistryAppId()) {
      setRegistryAppId(agentRegistryAppId);
      setRegistryId(agentRegistryAppId);
      setRegistryInput(String(agentRegistryAppId));
    }
    if (pollFactoryAppId > 0 && !getPollFactoryAppId()) {
      setPollFactoryAppId(pollFactoryAppId);
      setPollFactoryIdState(pollFactoryAppId);
      setPollFactoryInput(String(pollFactoryAppId));
    }
    if (ballotBoxAppId > 0 && !getBallotBoxAppId()) {
      setBallotBoxAppId(ballotBoxAppId);
      setBallotBoxIdState(ballotBoxAppId);
      setBallotBoxInput(String(ballotBoxAppId));
    }
  }, [context]);

  const primarySwarmId = context?.swarms[0] ?? null;

  const { data: agents, isLoading, isError, error } = useGovernanceAgents(
    registryId,
    ballotBoxId,
    pollFactoryId,
    primarySwarmId
  );

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const rId = parseInt(registryInput.trim(), 10);
    if (isNaN(rId) || rId <= 0) return;
    const bbId = parseInt(ballotBoxInput.trim(), 10);
    const pfId = parseInt(pollFactoryInput.trim(), 10);
    setRegistryAppId(rId);
    setBallotBoxAppId(isNaN(bbId) || bbId <= 0 ? null : bbId);
    setPollFactoryAppId(isNaN(pfId) || pfId <= 0 ? null : pfId);
    setRegistryId(rId);
    setBallotBoxIdState(isNaN(bbId) || bbId <= 0 ? null : bbId);
    setPollFactoryIdState(isNaN(pfId) || pfId <= 0 ? null : pfId);
    queryClient.invalidateQueries({ queryKey: ["governance-agents"] });
  }

  function handleDisconnect() {
    setRegistryAppId(null);
    setBallotBoxAppId(null);
    setPollFactoryAppId(null);
    setRegistryId(null);
    setBallotBoxIdState(null);
    setPollFactoryIdState(null);
    setRegistryInput("");
    setBallotBoxInput("");
    setPollFactoryInput("");
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground mb-2">
            SWARM.AGENTS
          </h1>
          <p className="text-muted-foreground">
            {primarySwarmId
              ? `Registered agents — scoped to swarm: ${primarySwarmId}`
              : "Registered agents with vote activity"}
          </p>
        </div>
        {registryId && (
          <a
            href={`${ALGOEXPLORER_APP}/${registryId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-primary hover:underline"
            data-testid="link-algoexplorer-registry"
          >
            AgentRegistry #{registryId} ↗
          </a>
        )}
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-6">
          <form onSubmit={handleConnect} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                AGENT REGISTRY APP ID
              </label>
              <Input
                type="number"
                placeholder="e.g. 123456789"
                value={registryInput}
                onChange={(e) => setRegistryInput(e.target.value)}
                className="bg-input/50 border-border focus-visible:ring-primary font-mono"
                data-testid="input-registry-app-id"
                min={1}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                BALLOT BOX APP ID{" "}
                <span className="text-muted-foreground/50 normal-case">(vote data)</span>
              </label>
              <Input
                type="number"
                placeholder="e.g. 987654321"
                value={ballotBoxInput}
                onChange={(e) => setBallotBoxInput(e.target.value)}
                className="bg-input/50 border-border focus-visible:ring-primary font-mono"
                data-testid="input-ballot-box-app-id"
                min={1}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                POLL FACTORY APP ID{" "}
                <span className="text-muted-foreground/50 normal-case">(participation %)</span>
              </label>
              <Input
                type="number"
                placeholder="e.g. 111222333"
                value={pollFactoryInput}
                onChange={(e) => setPollFactoryInput(e.target.value)}
                className="bg-input/50 border-border focus-visible:ring-primary font-mono"
                data-testid="input-poll-factory-app-id"
                min={1}
              />
            </div>
            <Button
              type="submit"
              className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!registryInput.trim() || isNaN(parseInt(registryInput, 10))}
              data-testid="button-connect-agents"
            >
              LOAD AGENTS
            </Button>
            {registryId && (
              <Button
                type="button"
                variant="outline"
                className="font-mono text-xs border-border"
                onClick={handleDisconnect}
                data-testid="button-disconnect-agents"
              >
                CLEAR
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {!registryId ? (
        <Card className="bg-card border-card-border border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="font-mono text-4xl text-muted-foreground/30 mb-2">0x00</div>
            <h3 className="font-mono text-lg font-bold text-foreground">
              NO AGENTS LOADED
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Enter your AgentRegistry App ID to load registered swarms from
              the Algorand Testnet. Add BallotBox and PollFactory IDs to enrich
              with vote activity and participation rates.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3" data-testid="agents-loading">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div
          className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md font-mono text-sm"
          data-testid="error-banner"
        >
          Failed to load agents: {String((error as Error).message)}
        </div>
      ) : agents && agents.length > 0 ? (
        <div data-testid="agents-table">
          <div className="text-xs font-mono text-muted-foreground mb-3">
            {agents.length} REGISTERED SWARM{agents.length !== 1 ? "S" : ""}
            {primarySwarmId ? ` · SCOPED TO: ${primarySwarmId}` : ""}
          </div>
          <div className="space-y-2">
            {agents.map((agent, i) => (
              <AgentRow key={agent.swarm_id} agent={agent} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="bg-card border-card-border border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="font-mono text-4xl text-muted-foreground/30 mb-2">0x00</div>
            <h3 className="font-mono text-lg font-bold text-foreground">
              NO AGENTS REGISTERED
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              {primarySwarmId
                ? `No agent registered under swarm "${primarySwarmId}" in AgentRegistry #${registryId}.`
                : `AgentRegistry app #${registryId} has no registered swarms yet.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
