import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

const SWARM_POLL_FACTORY_KEY = "al0_poll_factory_app_id";
const SWARM_BALLOT_BOX_KEY = "al0_ballot_box_app_id";
const SWARM_REGISTRY_KEY = "al0_registry_app_id";

export function getPollFactoryAppId(): number | null {
  const v = localStorage.getItem(SWARM_POLL_FACTORY_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
export function setPollFactoryAppId(id: number | null) {
  id === null
    ? localStorage.removeItem(SWARM_POLL_FACTORY_KEY)
    : localStorage.setItem(SWARM_POLL_FACTORY_KEY, String(id));
}

export function getBallotBoxAppId(): number | null {
  const v = localStorage.getItem(SWARM_BALLOT_BOX_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
export function setBallotBoxAppId(id: number | null) {
  id === null
    ? localStorage.removeItem(SWARM_BALLOT_BOX_KEY)
    : localStorage.setItem(SWARM_BALLOT_BOX_KEY, String(id));
}

export function getRegistryAppId(): number | null {
  const v = localStorage.getItem(SWARM_REGISTRY_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
export function setRegistryAppId(id: number | null) {
  id === null
    ? localStorage.removeItem(SWARM_REGISTRY_KEY)
    : localStorage.setItem(SWARM_REGISTRY_KEY, String(id));
}

export interface UserContext {
  swarms: string[];
  appIds: {
    agentRegistryAppId: number;
    pollFactoryAppId: number;
    ballotBoxAppId: number;
  };
}

export interface UsageStats {
  apiKeyId: number;
  swarmOwnerEmail: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  txCount: number;
  estimatedAlgoSpent: number;
}

export interface RelayTransaction {
  id: number;
  txType: string;
  algoTxId: string;
  status: string;
  createdAt: string;
}

export interface PollOption {
  text: string;
  votes: number | null;
}

export interface GovernancePoll {
  poll_id: number;
  creator: string;
  swarm_id: string;
  question: string;
  options: PollOption[];
  total_votes: number | null;
  status: "active" | "closed";
  expires_at: number;
  created_at: number;
}

export interface GovernanceAgent {
  swarm_id: string;
  address: string;
  registered_at: number;
  vote_count: number;
  last_active: number | null;
  participation_rate: number | null;
}

export function useUserContext() {
  const { apiKey, logout } = useAuth();
  return useQuery({
    queryKey: ["user-context", apiKey],
    queryFn: async (): Promise<UserContext> => {
      const res = await fetch("/api/keys/me/context", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401 || res.status === 403) { logout(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to fetch user context");
      return res.json();
    },
    enabled: !!apiKey,
    staleTime: 60_000,
  });
}

export function useUsageStats() {
  const { apiKey, logout } = useAuth();
  return useQuery({
    queryKey: ["usage-stats", apiKey],
    queryFn: async (): Promise<UsageStats> => {
      const res = await fetch("/api/keys/me/usage", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401 || res.status === 403) { logout(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to fetch usage stats");
      return res.json();
    },
    enabled: !!apiKey,
    refetchInterval: 30_000,
  });
}

export function useRelayTransactions(limit = 25) {
  const { apiKey, logout } = useAuth();
  return useQuery({
    queryKey: ["relay-transactions", apiKey, limit],
    queryFn: async (): Promise<RelayTransaction[]> => {
      const res = await fetch(`/api/keys/me/transactions?limit=${limit}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401 || res.status === 403) { logout(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      return data.transactions;
    },
    enabled: !!apiKey,
    refetchInterval: 30_000,
  });
}

export function useGovernancePolls(
  pollFactoryAppId: number | null,
  ballotBoxAppId: number | null,
  swarmId?: string | null
) {
  return useQuery({
    queryKey: ["governance-polls", pollFactoryAppId, ballotBoxAppId, swarmId],
    queryFn: async (): Promise<GovernancePoll[]> => {
      const params = new URLSearchParams({
        poll_factory_app_id: String(pollFactoryAppId!),
      });
      if (ballotBoxAppId) params.set("ballot_box_app_id", String(ballotBoxAppId));
      if (swarmId) params.set("swarm_id", swarmId);
      const res = await fetch(`/api/governance/polls?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.polls;
    },
    enabled: !!pollFactoryAppId,
    refetchInterval: 30_000,
  });
}

export function useGovernanceAgents(
  registryAppId: number | null,
  ballotBoxAppId?: number | null,
  pollFactoryAppId?: number | null,
  swarmId?: string | null
) {
  return useQuery({
    queryKey: ["governance-agents", registryAppId, ballotBoxAppId, pollFactoryAppId, swarmId],
    queryFn: async (): Promise<GovernanceAgent[]> => {
      const params = new URLSearchParams({
        registry_app_id: String(registryAppId!),
      });
      if (ballotBoxAppId) params.set("ballot_box_app_id", String(ballotBoxAppId));
      if (pollFactoryAppId) params.set("poll_factory_app_id", String(pollFactoryAppId));
      if (swarmId) params.set("swarm_id", swarmId);
      const res = await fetch(`/api/governance/agents?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.agents;
    },
    enabled: !!registryAppId,
    refetchInterval: 30_000,
  });
}
