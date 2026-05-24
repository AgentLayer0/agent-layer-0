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
