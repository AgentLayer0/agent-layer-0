export interface Poll {
  id: bigint;
  question: string;
  swarmId: string;
  creator: string;
  options: string[];
  optionCount: number;
  createdAt: bigint;
  expiresAt: bigint;
  isActive: boolean;
}

export interface PollResults {
  pollId: bigint;
  tallies: bigint[];
  totalVotes: bigint;
}

export interface RegisterAgentResult {
  swarmId: string;
  registryAppId: bigint;
}

export interface CreatePollResult {
  pollId: bigint;
}

export interface VoteResult {
  pollId: bigint;
  optionIndex: number;
}

export interface AL0ClientConfig {
  network?: "testnet" | "mainnet" | string;
}

export interface ApiKeyConfig extends AL0ClientConfig {
  apiKey: string;
  relayUrl?: string;
}

export interface MnemonicConfig extends AL0ClientConfig {
  mnemonic: string;
  rpc?: string;
}

export type ClientConfig = ApiKeyConfig | MnemonicConfig;

export function isApiKeyConfig(config: ClientConfig): config is ApiKeyConfig {
  return "apiKey" in config && typeof config.apiKey === "string";
}

export function isMnemonicConfig(config: ClientConfig): config is MnemonicConfig {
  return "mnemonic" in config && typeof config.mnemonic === "string";
}
