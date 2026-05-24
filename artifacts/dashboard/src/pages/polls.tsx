import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGovernancePolls,
  useUserContext,
  getPollFactoryAppId,
  setPollFactoryAppId,
  getBallotBoxAppId,
  setBallotBoxAppId,
  type GovernancePoll,
} from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";

const ALGOEXPLORER_APP = "https://testnet.algoexplorer.io/application";

function StatusBadge({ status }: { status: "active" | "closed" }) {
  return (
    <span
      className={`inline-block text-xs font-mono px-2 py-0.5 rounded uppercase ${
        status === "active"
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-muted text-muted-foreground border border-border"
      }`}
    >
      {status}
    </span>
  );
}

function PollCard({ poll }: { poll: GovernancePoll }) {
  const totalVotes = poll.total_votes ?? 0;
  const expiresDate = new Date(poll.expires_at * 1000);
  const isActive = poll.status === "active";

  return (
    <Card className="bg-card border-card-border hover:border-primary/30 transition-colors">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{poll.poll_id}
              </span>
              <StatusBadge status={poll.status} />
            </div>
            <h3 className="font-mono font-bold text-foreground text-sm leading-snug">
              {poll.question}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-mono font-bold text-primary">
              {totalVotes}
            </div>
            <div className="text-xs text-muted-foreground">votes</div>
          </div>
        </div>

        <div className="space-y-2">
          {poll.options.map((opt, i) => {
            const pct =
              totalVotes > 0 && opt.votes !== null
                ? Math.round((opt.votes / totalVotes) * 100)
                : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground truncate max-w-[70%]">
                    {String.fromCharCode(65 + i)}. {opt.text}
                  </span>
                  <span className="text-foreground shrink-0 ml-2">
                    {opt.votes !== null ? `${opt.votes} (${pct}%)` : "–"}
                  </span>
                </div>
                {opt.votes !== null && (
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1 border-t border-card-border">
          <span>SWARM: {poll.swarm_id}</span>
          <span title={format(expiresDate, "PPpp")}>
            {isActive
              ? `expires ${formatDistanceToNow(expiresDate, { addSuffix: true })}`
              : `expired ${format(expiresDate, "MM/dd/yy")}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PollsPage() {
  const { data: context } = useUserContext();

  const [pollFactoryInput, setPollFactoryInput] = useState(
    () => String(getPollFactoryAppId() ?? "")
  );
  const [ballotBoxInput, setBallotBoxInput] = useState(
    () => String(getBallotBoxAppId() ?? "")
  );
  const [pollFactoryId, setPollFactoryId] = useState<number | null>(getPollFactoryAppId);
  const [ballotBoxId, setBallotBoxId] = useState<number | null>(getBallotBoxAppId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!context) return;
    const { pollFactoryAppId, ballotBoxAppId } = context.appIds;
    if (pollFactoryAppId > 0 && !getPollFactoryAppId()) {
      setPollFactoryAppId(pollFactoryAppId);
      setPollFactoryId(pollFactoryAppId);
      setPollFactoryInput(String(pollFactoryAppId));
    }
    if (ballotBoxAppId > 0 && !getBallotBoxAppId()) {
      setBallotBoxAppId(ballotBoxAppId);
      setBallotBoxId(ballotBoxAppId);
      setBallotBoxInput(String(ballotBoxAppId));
    }
  }, [context]);

  const primarySwarmId = context?.swarms[0] ?? null;

  const { data: polls, isLoading, isError, error } = useGovernancePolls(
    pollFactoryId,
    ballotBoxId,
    primarySwarmId
  );

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const pfId = parseInt(pollFactoryInput.trim(), 10);
    if (isNaN(pfId) || pfId <= 0) return;
    const bbId = parseInt(ballotBoxInput.trim(), 10);
    const validBbId = isNaN(bbId) || bbId <= 0 ? null : bbId;
    setPollFactoryAppId(pfId);
    setBallotBoxAppId(validBbId);
    setPollFactoryId(pfId);
    setBallotBoxId(validBbId);
    queryClient.invalidateQueries({ queryKey: ["governance-polls"] });
  }

  function handleDisconnect() {
    setPollFactoryAppId(null);
    setBallotBoxAppId(null);
    setPollFactoryId(null);
    setBallotBoxId(null);
    setPollFactoryInput("");
    setBallotBoxInput("");
  }

  const activeCount = polls?.filter((p) => p.status === "active").length ?? 0;
  const closedCount = polls?.filter((p) => p.status === "closed").length ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground mb-2">
            GOVERNANCE.POLLS
          </h1>
          <p className="text-muted-foreground">
            {primarySwarmId
              ? `Showing polls for swarm: ${primarySwarmId}`
              : "Active and historical voting proposals"}
          </p>
        </div>
        {pollFactoryId && (
          <div className="flex gap-3 text-xs font-mono">
            <a
              href={`${ALGOEXPLORER_APP}/${pollFactoryId}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
              data-testid="link-algoexplorer-poll-factory"
            >
              PollFactory #{pollFactoryId} ↗
            </a>
            {ballotBoxId && (
              <a
                href={`${ALGOEXPLORER_APP}/${ballotBoxId}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
                data-testid="link-algoexplorer-ballot-box"
              >
                BallotBox #{ballotBoxId} ↗
              </a>
            )}
          </div>
        )}
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-6">
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                  POLL FACTORY APP ID
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 123456789"
                  value={pollFactoryInput}
                  onChange={(e) => setPollFactoryInput(e.target.value)}
                  className="bg-input/50 border-border focus-visible:ring-primary font-mono"
                  data-testid="input-poll-factory-app-id"
                  min={1}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                  BALLOT BOX APP ID{" "}
                  <span className="text-muted-foreground/50 normal-case">(optional, for vote tallies)</span>
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
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!pollFactoryInput.trim() || isNaN(parseInt(pollFactoryInput, 10))}
                  data-testid="button-connect-polls"
                >
                  LOAD POLLS
                </Button>
                {pollFactoryId && (
                  <Button
                    type="button"
                    variant="outline"
                    className="font-mono text-xs border-border"
                    onClick={handleDisconnect}
                    data-testid="button-disconnect-polls"
                  >
                    CLEAR
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {!pollFactoryId ? (
        <Card className="bg-card border-card-border border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <h3 className="font-mono text-lg font-bold text-foreground">
              AWAITING CONTRACT CONNECTION
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Enter your PollFactory App ID above to load on-chain governance
              polls from the Algorand Testnet.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3" data-testid="polls-loading">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div
          className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md font-mono text-sm"
          data-testid="error-banner"
        >
          Failed to load polls: {String((error as Error).message)}
        </div>
      ) : polls && polls.length > 0 ? (
        <>
          <div className="flex gap-4 text-xs font-mono text-muted-foreground">
            <span>
              <span className="text-green-400">{activeCount}</span> ACTIVE
            </span>
            <span>
              <span className="text-foreground">{closedCount}</span> CLOSED
            </span>
          </div>
          <div className="space-y-3" data-testid="polls-table">
            {polls.map((poll) => (
              <PollCard key={poll.poll_id} poll={poll} />
            ))}
          </div>
        </>
      ) : (
        <Card className="bg-card border-card-border border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <h3 className="font-mono text-lg font-bold text-foreground">
              NO POLLS FOUND
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              {primarySwarmId
                ? `No polls found for swarm "${primarySwarmId}" in PollFactory #${pollFactoryId}.`
                : `PollFactory app #${pollFactoryId} has no polls yet.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
