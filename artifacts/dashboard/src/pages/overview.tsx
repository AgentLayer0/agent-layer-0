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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Activity, Database, Server, Zap, CreditCard, TrendingUp } from "lucide-react";

const PLAN_QUOTAS: Record<string, number> = {
  free: 500,
  pro: 10_000,
  scale: 100_000,
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  scale: "Scale",
};

const PLAN_PRICES: Record<string, string> = {
  free: "$0/mo",
  pro: "$29/mo",
  scale: "$99/mo",
};

const PLAN_OVERAGE: Record<string, string | null> = {
  free: null,
  pro: null,
  scale: "$0.001/vote above 100k",
};

const PLAN_BADGE_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  free: "secondary",
  pro: "default",
  scale: "default",
};

const API_BASE = "/api";

async function startCheckout(priceId: string, apiKey: string) {
  const res = await fetch(`${API_BASE}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ priceId }),
  });
  const data = await res.json();
  if (data.url) window.open(data.url, "_blank");
}

async function openPortal(apiKey: string) {
  const res = await fetch(`${API_BASE}/billing/portal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (data.url) window.open(data.url, "_blank");
  else if (data.error) alert(data.error);
}

async function fetchPlans() {
  const res = await fetch(`${API_BASE}/billing/plans`);
  return await res.json();
}

export default function OverviewPage() {
  const [pollFactoryId] = useState<number | null>(getPollFactoryAppId);
  const [ballotBoxId] = useState<number | null>(getBallotBoxAppId);
  const [registryId] = useState<number | null>(getRegistryAppId);
  const [plans, setPlans] = useState<Array<{ id: string; name: string; priceId: string | null; price: number; quota: number; description: string }> | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

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

  const plan = (stats as any)?.plan ?? "free";
  const quota = PLAN_QUOTAS[plan] ?? 500;
  const txCountThisPeriod = (stats as any)?.txCountThisPeriod ?? 0;
  const overageVotes = (stats as any)?.overageVotes ?? 0;
  const periodResetAt = (stats as any)?.periodResetAt ?? null;
  const hasStripeCustomer = (stats as any)?.hasStripeCustomer ?? false;
  const usagePct = Math.min(100, Math.round((txCountThisPeriod / quota) * 100));
  const isNearLimit = plan !== "scale" && usagePct >= 80;
  const estimatedOverageCost = (overageVotes * 0.001).toFixed(2);

  function getApiKey(): string {
    return localStorage.getItem("al0_api_key") ?? "";
  }

  async function handleShowPlans() {
    if (!plans) {
      const data = await fetchPlans();
      setPlans(data.plans ?? []);
    }
    setShowPlans((v) => !v);
  }

  async function handleUpgrade(priceId: string) {
    setCheckoutLoading(priceId);
    try {
      await startCheckout(priceId, getApiKey());
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      await openPortal(getApiKey());
    } finally {
      setPortalLoading(false);
    }
  }

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
          BILLING.PLAN
        </h2>
        <Card className="bg-card border-card-border" data-testid="billing-card">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-32" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-lg" data-testid="billing-plan-name">
                          {PLAN_LABELS[plan] ?? plan}
                        </span>
                        <Badge variant={PLAN_BADGE_VARIANT[plan] ?? "secondary"} data-testid="billing-plan-badge">
                          {PLAN_PRICES[plan] ?? ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quota.toLocaleString()} relay transactions/month
                        {PLAN_OVERAGE[plan] && (
                          <span className="ml-1 text-primary">· {PLAN_OVERAGE[plan]}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {plan !== "free" && hasStripeCustomer ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleManage}
                        disabled={portalLoading}
                        data-testid="button-manage-billing"
                      >
                        {portalLoading ? "Opening..." : "Manage Subscription"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={plan === "free" ? "default" : "outline"}
                      onClick={handleShowPlans}
                      data-testid="button-upgrade"
                    >
                      <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                      {plan === "free" ? "Upgrade Plan" : "Change Plan"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-mono text-xs">
                      RELAY TXS THIS PERIOD
                    </span>
                    <span
                      className={`font-mono text-xs font-medium ${isNearLimit ? "text-destructive" : "text-foreground"}`}
                      data-testid="billing-usage-count"
                    >
                      {txCountThisPeriod.toLocaleString()} / {quota.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={usagePct}
                    className={`h-2 ${isNearLimit ? "[&>div]:bg-destructive" : ""}`}
                    data-testid="billing-usage-bar"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{usagePct}% of quota used</span>
                    {periodResetAt && (
                      <span>Resets {format(new Date(periodResetAt), "MMM d, yyyy")}</span>
                    )}
                  </div>
                  {isNearLimit && (
                    <p className="text-xs text-destructive font-mono">
                      ⚠ Approaching quota limit — upgrade to avoid relay interruptions
                    </p>
                  )}
                  {plan === "scale" && overageVotes > 0 && (
                    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 flex items-center justify-between" data-testid="overage-row">
                      <span className="text-xs font-mono text-muted-foreground">
                        OVERAGE THIS PERIOD
                      </span>
                      <div className="text-right">
                        <span className="text-xs font-mono font-medium text-primary" data-testid="overage-count">
                          {overageVotes.toLocaleString()} votes
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (~${estimatedOverageCost} billed at renewal)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {showPlans && plans && (
                  <div className="border-t border-card-border pt-4">
                    <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">
                      Available Plans
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {plans.map((p) => (
                        <div
                          key={p.id}
                          className={`border rounded-lg p-3 flex flex-col gap-2 ${p.id === plan ? "border-primary bg-primary/5" : "border-card-border"}`}
                          data-testid={`plan-card-${p.id}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono font-bold text-sm">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{PLAN_PRICES[p.id]}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                          {PLAN_OVERAGE[p.id] && (
                            <p className="text-xs text-primary font-mono">{PLAN_OVERAGE[p.id]}</p>
                          )}
                          {p.id === plan ? (
                            <span className="text-xs text-primary font-mono mt-auto">Current plan</span>
                          ) : p.priceId ? (
                            <Button
                              size="sm"
                              className="w-full mt-auto"
                              onClick={() => handleUpgrade(p.priceId!)}
                              disabled={checkoutLoading === p.priceId}
                              data-testid={`button-select-plan-${p.id}`}
                            >
                              {checkoutLoading === p.priceId ? "Loading..." : `Select ${p.name}`}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground mt-auto">No payment required</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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
