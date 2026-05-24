export type AgentRegistryMethod =
  | "register_swarm"
  | "get_owner"
  | "is_registered"
  | "get_total_swarms";

export type PollFactoryMethod =
  | "bootstrap"
  | "create_poll"
  | "get_poll"
  | "get_poll_meta"
  | "is_active"
  | "get_next_poll_id"
  | "get_registry_app_id";

export type BallotBoxMethod =
  | "bootstrap"
  | "init_poll"
  | "cast_vote"
  | "get_tally"
  | "has_voted"
  | "get_vote"
  | "get_total_votes"
  | "get_factory_app_id";

export interface TallyRecord {
  tally_0: bigint;
  tally_1: bigint;
  tally_2: bigint;
  tally_3: bigint;
  tally_4: bigint;
  tally_5: bigint;
  tally_6: bigint;
  tally_7: bigint;
}

export interface PollRecord {
  creator: string;
  swarm_id: string;
  question: string;
  option_count: bigint;
  option_0: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  option_6: string;
  option_7: string;
  created_at: bigint;
  expires_at: bigint;
}

export interface PollMeta {
  expires_at: bigint;
  option_count: bigint;
}
