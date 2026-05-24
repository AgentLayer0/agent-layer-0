export interface UsageStats {
  apiKeyId: number;
  swarmOwnerEmail: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  txCount: number;
  estimatedAlgoSpent: number;
}

export interface AlgorandTransaction {
  id: string;
  sender: string;
  fee: number;
  roundTime: number;
  confirmedRound: number;
  txType: string;
  note: string | null;
}

export interface AlgorandAccount {
  address: string;
  amount: number;
  totalAppsOptedIn: number;
  round: number;
}

export interface AlgorandBox {
  name: string;
  value: string;
}

export interface AlgorandAppStateValue {
  bytes: string;
  uint: number;
  type: number;
}

export interface AlgorandAppGlobalState {
  key: string;
  value: AlgorandAppStateValue;
}

export interface AlgorandAppInfo {
  id: number;
  params: {
    creator: string;
    "global-state": AlgorandAppGlobalState[];
    "global-state-schema": { "num-byte-slice": number; "num-uint": number };
    "local-state-schema": { "num-byte-slice": number; "num-uint": number };
  };
}

export interface ParsedPoll {
  boxName: string;
  boxNameDecoded: string;
  rawValue: string;
  decodedValue: string;
}

export interface ParsedAgent {
  key: string;
  keyDecoded: string;
  valueType: "bytes" | "uint";
  valueRaw: string;
  valueDecoded: string;
}

const INDEXER_BASE = "https://testnet-idx.algonode.cloud/v2";
const ALGOEXPLORER_TX = "https://testnet.algoexplorer.io/tx";
const ALGOEXPLORER_ADDR = "https://testnet.algoexplorer.io/address";
const ALGOEXPLORER_APP = "https://testnet.algoexplorer.io/application";

export { ALGOEXPLORER_TX, ALGOEXPLORER_ADDR, ALGOEXPLORER_APP };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function tryDecodeUtf8(b64: string): string {
  try {
    const bytes = b64ToBytes(b64);
    const str = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return str.replace(/[^\x20-\x7E\n\r\t]/g, ".");
  } catch {
    return `0x${bytesToHex(b64ToBytes(b64))}`;
  }
}

export function parseBoxName(b64Name: string): string {
  try {
    const bytes = b64ToBytes(b64Name);
    const str = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/^[\x20-\x7E]+$/.test(str)) return str;
    return `0x${bytesToHex(bytes)}`;
  } catch {
    return `0x${bytesToHex(b64ToBytes(b64Name))}`;
  }
}

export async function fetchAccountTransactions(
  address: string,
  limit = 20
): Promise<AlgorandTransaction[]> {
  const res = await fetch(
    `${INDEXER_BASE}/accounts/${address}/transactions?limit=${limit}`
  );
  if (!res.ok) throw new Error(`Indexer error: ${res.status}`);
  const data = await res.json();
  return (data.transactions ?? []).map((tx: Record<string, unknown>) => ({
    id: tx["id"] as string,
    sender: tx["sender"] as string,
    fee: tx["fee"] as number,
    roundTime: tx["round-time"] as number,
    confirmedRound: tx["confirmed-round"] as number,
    txType: tx["tx-type"] as string,
    note: tx["note"] ? tryDecodeUtf8(tx["note"] as string) : null,
  }));
}

export async function fetchAccount(
  address: string
): Promise<AlgorandAccount | null> {
  const res = await fetch(`${INDEXER_BASE}/accounts/${address}`);
  if (!res.ok) return null;
  const data = await res.json();
  const acc = data.account;
  if (!acc) return null;
  return {
    address: acc["address"],
    amount: acc["amount"],
    totalAppsOptedIn: acc["total-apps-opted-in"] ?? 0,
    round: data["current-round"] ?? 0,
  };
}

export async function fetchApplicationBoxes(appId: number): Promise<AlgorandBox[]> {
  const res = await fetch(`${INDEXER_BASE}/applications/${appId}/boxes`);
  if (!res.ok) throw new Error(`Indexer error: ${res.status}`);
  const data = await res.json();
  return data.boxes ?? [];
}

export async function fetchApplicationBoxValue(
  appId: number,
  boxName: string
): Promise<string | null> {
  const encoded = encodeURIComponent(`b64:${boxName}`);
  const res = await fetch(
    `${INDEXER_BASE}/applications/${appId}/box?name=${encoded}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.value ?? null;
}

export async function fetchApplicationInfo(appId: number): Promise<AlgorandAppInfo | null> {
  const res = await fetch(`${INDEXER_BASE}/applications/${appId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.application ?? null;
}

export async function fetchApplicationBoxesWithValues(
  appId: number
): Promise<ParsedPoll[]> {
  const boxes = await fetchApplicationBoxes(appId);
  const results: ParsedPoll[] = [];

  for (const box of boxes) {
    const value = await fetchApplicationBoxValue(appId, box.name);
    results.push({
      boxName: box.name,
      boxNameDecoded: parseBoxName(box.name),
      rawValue: value ?? "",
      decodedValue: value ? tryDecodeUtf8(value) : "",
    });
  }

  return results;
}

export function parseGlobalStateAgents(
  globalState: AlgorandAppGlobalState[]
): ParsedAgent[] {
  return globalState.map((entry) => {
    const keyDecoded = tryDecodeUtf8(entry.key);
    if (entry.value.type === 2) {
      return {
        key: entry.key,
        keyDecoded,
        valueType: "uint",
        valueRaw: String(entry.value.uint),
        valueDecoded: String(entry.value.uint),
      };
    }
    const decoded = tryDecodeUtf8(entry.value.bytes);
    return {
      key: entry.key,
      keyDecoded,
      valueType: "bytes",
      valueRaw: entry.value.bytes,
      valueDecoded: decoded,
    };
  });
}
