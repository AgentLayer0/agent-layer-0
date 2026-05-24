import algosdk from "algosdk";
import { logger } from "./logger";

const ALGOD_SERVER = process.env["ALGOD_SERVER"] ?? "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = process.env["ALGOD_TOKEN"] ?? "";
const ALGOD_PORT = process.env["ALGOD_PORT"] ?? "";
const RELAY_LOW_BALANCE_THRESHOLD = 1_000_000;

let _algod: algosdk.Algodv2 | null = null;
let _account: algosdk.Account | null = null;

export function getAlgodClient(): algosdk.Algodv2 {
  if (!_algod) {
    _algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
  }
  return _algod;
}

export function getRelayAccount(): algosdk.Account {
  if (!_account) {
    const mnemonic = process.env["RELAY_WALLET_MNEMONIC"];
    if (!mnemonic) {
      throw new Error("RELAY_WALLET_MNEMONIC environment variable is required for relay operations.");
    }
    _account = algosdk.mnemonicToSecretKey(mnemonic);
  }
  return _account;
}

export function makeRelayAddress(): string {
  return getRelayAccount().addr.toString();
}

export function makeRelaySigner(): algosdk.TransactionSigner {
  const account = getRelayAccount();
  return algosdk.makeBasicAccountTransactionSigner(account);
}

export async function checkRelayBalance(): Promise<void> {
  const mnemonic = process.env["RELAY_WALLET_MNEMONIC"];
  if (!mnemonic) {
    logger.warn("RELAY_WALLET_MNEMONIC is not set — relay wallet unavailable");
    return;
  }

  try {
    const account = getRelayAccount();
    const algod = getAlgodClient();
    const info = await algod.accountInformation(account.addr.toString()).do();
    const balanceMicroAlgo = Number(info.amount);
    const balanceAlgo = balanceMicroAlgo / 1_000_000;

    if (balanceMicroAlgo < RELAY_LOW_BALANCE_THRESHOLD) {
      logger.warn(
        { address: account.addr.toString(), balanceAlgo },
        "Relay wallet balance is below 1 ALGO — top up immediately",
      );
    } else {
      logger.info(
        { address: account.addr.toString(), balanceAlgo },
        "Relay wallet ready",
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to check relay wallet balance");
  }
}
