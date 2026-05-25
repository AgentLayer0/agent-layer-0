import {
  getDeployedAppIds,
  BallotBoxClient,
  PollFactoryClient,
} from "@workspace/al0-contracts";
import { getAlgodClient, makeRelayAddress, makeRelaySigner } from "./relay-wallet";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60 * 1000;

async function runCleanup(): Promise<void> {
  const appIds = getDeployedAppIds();
  if (!appIds.ballotBoxAppId || !appIds.pollFactoryAppId) {
    logger.warn("cleanup-job: contracts not configured — skipping");
    return;
  }

  const algod = getAlgodClient();
  const sender = makeRelayAddress();
  const signer = makeRelaySigner();
  const factory = new PollFactoryClient(appIds.pollFactoryAppId, algod);
  const ballot = new BallotBoxClient(appIds.ballotBoxAppId, algod);

  let nextPollId: bigint;
  try {
    nextPollId = await factory.getNextPollId();
  } catch (err) {
    logger.error({ err }, "cleanup-job: failed to fetch poll count");
    return;
  }

  if (nextPollId === 0n) return;

  let totalDeleted = 0;
  let totalRecoveredMicro = 0;

  for (let pollId = 0; pollId < Number(nextPollId); pollId++) {
    try {
      const isActive = await factory.isActive({ poll_id: BigInt(pollId) });
      if (isActive) continue;

      const voters = await ballot.getVotersForPoll(pollId);
      if (voters.length === 0) continue;

      logger.info({ pollId, voterCount: voters.length }, "cleanup-job: recycling expired poll");

      const sp = await algod.getTransactionParams().do();
      for (const voter of voters) {
        try {
          await ballot.deleteVoteBox(sender, signer, { poll_id: pollId, voter }, sp);
          totalDeleted++;
          totalRecoveredMicro += 22_500;
        } catch (err) {
          logger.warn(
            { pollId, voter, err: err instanceof Error ? err.message : String(err) },
            "cleanup-job: deleteVoteBox failed"
          );
        }
      }
    } catch (err) {
      logger.warn({ err, pollId }, "cleanup-job: error processing poll — skipping");
    }
  }

  if (totalDeleted > 0) {
    logger.info(
      { totalDeleted, mbrRecoveredAlgo: totalRecoveredMicro / 1_000_000 },
      "cleanup-job: run complete"
    );
  } else {
    logger.info("cleanup-job: nothing to reclaim");
  }
}

export function scheduleCleanup(): void {
  setTimeout(() => {
    runCleanup().catch((err) => logger.error({ err }, "cleanup-job: unhandled error"));
    setInterval(() => {
      runCleanup().catch((err) => logger.error({ err }, "cleanup-job: unhandled error"));
    }, CLEANUP_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  logger.info(
    { intervalHours: CLEANUP_INTERVAL_MS / 3_600_000, startupDelaySeconds: STARTUP_DELAY_MS / 1000 },
    "cleanup-job: scheduled"
  );
}
