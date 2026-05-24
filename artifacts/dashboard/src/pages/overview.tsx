import { useState } from "react";
import {
  useUsageStats,
  useGovernancePolls,
  useGovernanceAgents,
  useUserContext,
  getPollFactoryAppId,
  getBallotBoxAppId,
  getRegistryAppId,
} from "@/hooks/useData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Activity, Database, Server, Zap } from "lucide-react";

export default function OverviewPage() {
  const [pollFactoryId] = useState<number | null>(getPollFactoryAppId);
  const [ballotBoxId] = useState<number | null>(getBallotBoxAppId);
  const [registryId] = useState<number | null>(getRegistryAppId);

  const { data: context } = useUserContext();
  const { data: stats, isLoading: statsLoading, isError, error } = useUsageStats();

  const resolvedPollFactory = pollFactoryId ?? (context?.appIds.pollFactoryAppId || null);
  const resolvedBallotBox = ballotBoxId ?? (context?.appIds.ballotBoxAppId || null);
  const resolvedRegistry = registryId ?? (context?.appIds.agentRegistryAppId || null);
  const primarySwarmId = context?.swarms[0] ?? null;

  const { data: polls } = useGovernancePolls(
    resolvedPollFactory,
    resolvedBallotBox,
    primarySwarmId
  );
  const { data: agents } = useGovernanceAgents(
    resolvedRegistry,
    resolvedBallotBox,
    resolvedPollFactory,
    primarySwarmId
  );

  const activePolls =
    resolvedPollFactory && polls ? polls.filter((p) => p.status === "active").length : null;

  const totalVotes =
    resolvedPollFactory && polls
      ? polls.reduce((sum, p) => sum + (p.total_votes ?? 0), 0)
      : null;

  const registeredAgents = resolvedRegistry && agents ? agents.length : null;

  if (isError) {
    return (
      <div
        className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md font-mono text-sm"
        data-testid="error-banner"
      >
        Error loading overview: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold font-mono text-foreground mb-2">
          SYSTEM.OVERVIEW
        </h1>
        <p className="text-muted-foreground">Swarm status and relay metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="ACTIVE POLLS"
          value={
            resolvedPollFactory
              ? activePolls === null
                ? null
                : String(activePolls)
              : "–"
          }
          icon={Activity}
          subtitle={
            resolvedPollFactory
              ? primarySwarmId
                ? `Swarm: ${primarySwarmId}`
                : "On-chain governance polls"
              : "Set App IDs in Polls page"
          }
          testId="metric-polls"
        />
        <MetricCard
          title="TOTAL VOTES"
          value={
            resolvedPollFactory
              ? totalVotes === null
                ? null
                : totalVotes.toLocaleString()
              : "–"
          }
          icon={Database}
          subtitle={
            resolvedPollFactory
              ? "Votes cast across all polls"
              : "Set App IDs in Polls page"
          }
          testId="metric-votes"
        />
        <MetricCard
          title="REGISTERED AGENTS"
          value={
            resolvedRegistry
              ? registeredAgents === null
                ? null
                : String(registeredAgents)
              : "–"
          }
          icon={Server}
          subtitle={
            resolvedRegistry
              ? primarySwarmId
                ? `Swarm: ${primarySwarmId}`
                : "Swarms in AgentRegistry"
              : "Set App IDs in Agents page"
          }
          testId="metric-agents"
        />
        <MetricCard
          title="RELAY ALGO SPENT"
          value={
            statsLoading
              ? null
              : (stats?.estimatedAlgoSpent ?? 0).toFixed(6)
          }
          icon={Zap}
          subtitle="Total fees paid via AL0 relay"
          testId="metric-spent"
          valueColor="text-primary"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold font-mono text-foreground mb-4">
          ACCESS.METRICS
        </h2>
        <Card className="bg-card border-card-border">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : stats ? (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    OPERATOR EMAIL
                  </dt>
                  <dd className="font-medium" data-testid="text-email">
                    {stats.swarmOwnerEmail}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    KEY NAME
                  </dt>
                  <dd className="font-medium" data-testid="text-keyname">
                    {stats.name || "Unnamed Key"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    CREATED AT
                  </dt>
                  <dd className="font-mono" data-testid="text-created">
                    {format(new Date(stats.createdAt), "PPpp")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    LAST USED
                  </dt>
                  <dd className="font-mono" data-testid="text-lastused">
                    {stats.lastUsedAt
                      ? format(new Date(stats.lastUsedAt), "PPpp")
                      : "Never"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    TOTAL RELAY TXS
                  </dt>
                  <dd
                    className="font-mono text-primary font-bold"
                    data-testid="text-txcount"
                  >
                    {stats.txCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-mono text-xs mb-1">
                    MY SWARMS
                  </dt>
                  <dd
                    className="font-mono text-muted-foreground text-xs"
                    data-testid="text-swarms"
                  >
                    {context?.swarms.length
                      ? context.swarms.join(", ")
                      : "None registered"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  testId,
  valueColor = "text-foreground",
}: {
  title: string;
  value: string | null;
  icon: React.ElementType;
  subtitle: string;
  testId: string;
  valueColor?: string;
}) {
  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <div
            className={`text-3xl font-mono font-bold ${valueColor}`}
            data-testid={testId}
          >
            {value}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
