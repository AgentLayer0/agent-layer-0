export type AL0ErrorCode =
  | "INVALID_CONFIG"
  | "INVALID_INPUT"
  | "NETWORK_ERROR"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "UNAUTHORIZED"
  | "POLL_EXPIRED"
  | "ALREADY_VOTED"
  | "RELAY_ERROR"
  | "UNKNOWN";

export class AL0Error extends Error {
  readonly code: AL0ErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: AL0ErrorCode, cause?: unknown) {
    super(message);
    this.name = "AL0Error";
    this.code = code;
    this.cause = cause;
  }

  static invalidConfig(message: string): AL0Error {
    return new AL0Error(message, "INVALID_CONFIG");
  }

  static invalidInput(message: string): AL0Error {
    return new AL0Error(message, "INVALID_INPUT");
  }

  static notFound(message: string): AL0Error {
    return new AL0Error(message, "NOT_FOUND");
  }

  static alreadyExists(message: string): AL0Error {
    return new AL0Error(message, "ALREADY_EXISTS");
  }

  static pollExpired(pollId: bigint | number): AL0Error {
    return new AL0Error(`Poll ${pollId} has expired`, "POLL_EXPIRED");
  }

  static alreadyVoted(pollId: bigint | number): AL0Error {
    return new AL0Error(`Already voted on poll ${pollId}`, "ALREADY_VOTED");
  }

  static fromUnknown(err: unknown, fallback: AL0ErrorCode = "UNKNOWN"): AL0Error {
    if (err instanceof AL0Error) return err;

    const message =
      err instanceof Error ? err.message : String(err ?? "Unknown error");

    if (/already registered/i.test(message)) {
      return new AL0Error(message, "ALREADY_EXISTS", err);
    }
    if (/not registered|not found/i.test(message)) {
      return new AL0Error(message, "NOT_FOUND", err);
    }
    if (/expired/i.test(message)) {
      return new AL0Error(message, "POLL_EXPIRED", err);
    }
    if (/already voted/i.test(message)) {
      return new AL0Error(message, "ALREADY_VOTED", err);
    }
    if (/network|fetch|connect|ECONNREFUSED/i.test(message)) {
      return new AL0Error(message, "NETWORK_ERROR", err);
    }
    if (/unauthorized|403/i.test(message)) {
      return new AL0Error(message, "UNAUTHORIZED", err);
    }

    return new AL0Error(message, fallback, err);
  }
}
