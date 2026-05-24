import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export interface DeployedAppIds {
  network: string;
  agentRegistryAppId: number;
  pollFactoryAppId: number;
  ballotBoxAppId: number;
  deployedAt: string;
}

const EMPTY: DeployedAppIds = {
  network: "undeployed",
  agentRegistryAppId: 0,
  pollFactoryAppId: 0,
  ballotBoxAppId: 0,
  deployedAt: "",
};

let _cached: DeployedAppIds | null = null;

export function getDeployedAppIds(): DeployedAppIds {
  if (_cached) return _cached;

  // Prefer environment variables — reliable across bundled and unbundled contexts.
  const registryId = Number(process.env["AGENT_REGISTRY_APP_ID"] ?? 0);
  const factoryId = Number(process.env["POLL_FACTORY_APP_ID"] ?? 0);
  const ballotId = Number(process.env["BALLOT_BOX_APP_ID"] ?? 0);

  if (registryId && factoryId && ballotId) {
    _cached = {
      network: process.env["ALGORAND_NETWORK"] ?? "testnet",
      agentRegistryAppId: registryId,
      pollFactoryAppId: factoryId,
      ballotBoxAppId: ballotId,
      deployedAt: "",
    };
    return _cached;
  }

  // Fall back to deployed-app-ids.json (dev / local runs via tsx).
  try {
    const require = createRequire(import.meta.url);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const jsonPath = join(__dirname, "../../deployed-app-ids.json");
    _cached = require(jsonPath) as DeployedAppIds;
    return _cached;
  } catch {
    return EMPTY;
  }
}
