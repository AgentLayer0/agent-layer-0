import { describe, it, expect, vi, beforeEach } from "vitest";
import { AL0Client } from "../src/client.js";
import { AL0Error } from "../src/error.js";

vi.mock("@workspace/al0-contracts", () => {
  const mockRegistry = {
    registerSwarm: vi.fn(),
  };
  const mockFactory = {
    createPoll: vi.fn(),
    getPoll: vi.fn(),
    getPollMeta: vi.fn(),
    isActive: vi.fn(),
    getNextPollId: vi.fn(),
  };
  const mockBallot = {
    initPoll: vi.fn(),
    castVote: vi.fn(),
    getTally: vi.fn(),
    hasVoted: vi.fn(),
  };

  return {
    AgentRegistryClient: vi.fn(() => mockRegistry),
    PollFactoryClient: vi.fn(() => mockFactory),
    BallotBoxClient: vi.fn(() => mockBallot),
    getDeployedAppIds: vi.fn(() => ({
      network: "testnet",
      agentRegistryAppId: 1001,
      pollFactoryAppId: 1002,
      ballotBoxAppId: 1003,
      deployedAt: "2025-01-01T00:00:00Z",
    })),
  };
});

vi.mock("algosdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("algosdk")>();
  return {
    ...actual,
    mnemonicToSecretKey: vi.fn(() => ({
      addr: { toString: () => "TESTADDR" },
      sk: new Uint8Array(64),
    })),
    makeBasicAccountTransactionSigner: vi.fn(() => vi.fn()),
    Algodv2: vi.fn(() => ({})),
  };
});

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest";

function makeMnemonicClient() {
  return new AL0Client({ mnemonic: TEST_MNEMONIC, network: "testnet" });
}

function makeApiKeyClient() {
  return new AL0Client({
    apiKey: "al0_sk_test",
    relayUrl: "https://relay.example.com",
  });
}

async function getContractMocks() {
  const mod = await import("@workspace/al0-contracts");
  const AgentRegistryClient = mod.AgentRegistryClient as unknown as ReturnType<typeof vi.fn>;
  const PollFactoryClient = mod.PollFactoryClient as unknown as ReturnType<typeof vi.fn>;
  const BallotBoxClient = mod.BallotBoxClient as unknown as ReturnType<typeof vi.fn>;
  return {
    registry: AgentRegistryClient.mock.results[AgentRegistryClient.mock.results.length - 1]!.value as {
      registerSwarm: ReturnType<typeof vi.fn>;
    },
    factory: PollFactoryClient.mock.results[PollFactoryClient.mock.results.length - 1]!.value as {
      createPoll: ReturnType<typeof vi.fn>;
      getPoll: ReturnType<typeof vi.fn>;
      getPollMeta: ReturnType<typeof vi.fn>;
      isActive: ReturnType<typeof vi.fn>;
      getNextPollId: ReturnType<typeof vi.fn>;
    },
    ballot: BallotBoxClient.mock.results[BallotBoxClient.mock.results.length - 1]!.value as {
      initPoll: ReturnType<typeof vi.fn>;
      castVote: ReturnType<typeof vi.fn>;
      getTally: ReturnType<typeof vi.fn>;
      hasVoted: ReturnType<typeof vi.fn>;
    },
  };
}

describe("AL0Client — constructor validation", () => {
  it("accepts a valid apiKey config", () => {
    expect(() => makeApiKeyClient()).not.toThrow();
  });

  it("accepts a valid mnemonic config", () => {
    expect(() => makeMnemonicClient()).not.toThrow();
  });

  it("throws AL0Error for invalid apiKey prefix", () => {
    expect(
      () => new AL0Client({ apiKey: "bad_key" })
    ).toThrowError(AL0Error);
  });

  it("throws AL0Error when no auth mode provided", () => {
    expect(
      () => new AL0Client({} as never)
    ).toThrowError(AL0Error);
  });

  it("reports authMode correctly", () => {
    expect(makeMnemonicClient().authMode).toBe("mnemonic");
    expect(makeApiKeyClient().authMode).toBe("apiKey");
  });
});

describe("AL0Client — mnemonic mode: registerAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls AgentRegistryClient.registerSwarm and returns result", async () => {
    makeMnemonicClient();
    const { registry } = await getContractMocks();
    registry.registerSwarm.mockResolvedValue({ appId: 1001n });

    const client = makeMnemonicClient();
    const result = await client.registerAgent({ swarmId: "my-swarm" });

    expect(registry.registerSwarm).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      { swarm_id: "my-swarm" }
    );
    expect(result).toEqual({ swarmId: "my-swarm", registryAppId: 1001n });
  });

  it("throws AL0Error with INVALID_INPUT for empty swarmId", async () => {
    const client = makeMnemonicClient();
    await expect(client.registerAgent({ swarmId: "" })).rejects.toBeInstanceOf(
      AL0Error
    );
    const err = await client
      .registerAgent({ swarmId: "" })
      .catch((e: unknown) => e as AL0Error);
    expect(err.code).toBe("INVALID_INPUT");
  });

  it("wraps algosdk already-registered error as ALREADY_EXISTS", async () => {
    makeMnemonicClient();
    const { registry } = await getContractMocks();
    registry.registerSwarm.mockRejectedValue(
      new Error("swarm_id already registered")
    );

    const client = makeMnemonicClient();
    const err = await client
      .registerAgent({ swarmId: "dup-swarm" })
      .catch((e: unknown) => e as AL0Error);

    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("ALREADY_EXISTS");
  });
});

describe("AL0Client — mnemonic mode: createPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls factory.createPoll + ballot.initPoll and returns pollId", async () => {
    makeMnemonicClient();
    const { factory, ballot } = await getContractMocks();
    factory.createPoll.mockResolvedValue({ pollId: 7n });
    ballot.initPoll.mockResolvedValue(undefined);

    const client = makeMnemonicClient();
    const result = await client.createPoll({
      swarmId: "swarm-1",
      question: "Best option?",
      options: ["A", "B", "C"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(factory.createPoll).toHaveBeenCalledOnce();
    expect(ballot.initPoll).toHaveBeenCalledOnce();
    expect(result).toEqual({ pollId: 7n });
  });

  it("throws INVALID_INPUT when fewer than 2 options are given", async () => {
    const client = makeMnemonicClient();
    const err = await client
      .createPoll({
        swarmId: "s",
        question: "?",
        options: ["only one"],
        expiresAt: 9999999999,
      })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("INVALID_INPUT");
  });

  it("throws INVALID_INPUT when more than 8 options are given", async () => {
    const client = makeMnemonicClient();
    const err = await client
      .createPoll({
        swarmId: "s",
        question: "?",
        options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        expiresAt: 9999999999,
      })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("INVALID_INPUT");
  });
});

describe("AL0Client — mnemonic mode: vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("casts vote successfully", async () => {
    makeMnemonicClient();
    const { factory, ballot } = await getContractMocks();
    factory.isActive.mockResolvedValue(true);
    ballot.hasVoted.mockResolvedValue(false);
    ballot.castVote.mockResolvedValue(undefined);

    const client = makeMnemonicClient();
    const result = await client.vote({ pollId: 3n, optionIndex: 1 });

    expect(factory.isActive).toHaveBeenCalledWith({ poll_id: 3n });
    expect(ballot.hasVoted).toHaveBeenCalledWith({
      poll_id: 3n,
      voter: expect.any(String),
    });
    expect(ballot.castVote).toHaveBeenCalledOnce();
    expect(result).toEqual({ pollId: 3n, optionIndex: 1 });
  });

  it("throws POLL_EXPIRED when poll is inactive", async () => {
    makeMnemonicClient();
    const { factory } = await getContractMocks();
    factory.isActive.mockResolvedValue(false);

    const client = makeMnemonicClient();
    const err = await client
      .vote({ pollId: 5n, optionIndex: 0 })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("POLL_EXPIRED");
  });

  it("throws ALREADY_VOTED when voter has already voted", async () => {
    makeMnemonicClient();
    const { factory, ballot } = await getContractMocks();
    factory.isActive.mockResolvedValue(true);
    ballot.hasVoted.mockResolvedValue(true);

    const client = makeMnemonicClient();
    const err = await client
      .vote({ pollId: 5n, optionIndex: 0 })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("ALREADY_VOTED");
  });
});

describe("AL0Client — mnemonic mode: getPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecord = {
    creator: "TESTADDR",
    swarm_id: "swarm-1",
    question: "Best option?",
    option_count: 2n,
    option_0: "A",
    option_1: "B",
    option_2: "",
    option_3: "",
    option_4: "",
    option_5: "",
    option_6: "",
    option_7: "",
    created_at: 1000n,
    expires_at: 9999999999n,
  };

  it("returns a typed Poll with only active options", async () => {
    makeMnemonicClient();
    const { factory } = await getContractMocks();
    factory.getPoll.mockResolvedValue(mockRecord);
    factory.isActive.mockResolvedValue(true);

    const client = makeMnemonicClient();
    const poll = await client.getPoll(0n);

    expect(poll.id).toBe(0n);
    expect(poll.question).toBe("Best option?");
    expect(poll.options).toEqual(["A", "B"]);
    expect(poll.optionCount).toBe(2);
    expect(poll.isActive).toBe(true);
  });
});

describe("AL0Client — mnemonic mode: getResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tallies sliced to option_count", async () => {
    makeMnemonicClient();
    const { factory, ballot } = await getContractMocks();
    ballot.getTally.mockResolvedValue({
      tally_0: 5n,
      tally_1: 3n,
      tally_2: 0n,
      tally_3: 0n,
      tally_4: 0n,
      tally_5: 0n,
      tally_6: 0n,
      tally_7: 0n,
    });
    factory.getPollMeta.mockResolvedValue({ expires_at: 9999999999n, option_count: 2n });

    const client = makeMnemonicClient();
    const results = await client.getResults(0n);

    expect(results.pollId).toBe(0n);
    expect(results.tallies).toEqual([5n, 3n]);
    expect(results.totalVotes).toBe(8n);
  });
});

describe("AL0Client — mnemonic mode: listPolls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no polls exist", async () => {
    makeMnemonicClient();
    const { factory } = await getContractMocks();
    factory.getNextPollId.mockResolvedValue(0n);

    const client = makeMnemonicClient();
    const polls = await client.listPolls();
    expect(polls).toEqual([]);
  });

  it("fetches and returns all polls", async () => {
    makeMnemonicClient();
    const { factory } = await getContractMocks();
    factory.getNextPollId.mockResolvedValue(2n);
    factory.getPoll.mockResolvedValue({
      creator: "TESTADDR",
      swarm_id: "s",
      question: "Q",
      option_count: 2n,
      option_0: "A",
      option_1: "B",
      option_2: "",
      option_3: "",
      option_4: "",
      option_5: "",
      option_6: "",
      option_7: "",
      created_at: 1000n,
      expires_at: 9999999999n,
    });
    factory.isActive.mockResolvedValue(true);

    const client = makeMnemonicClient();
    const polls = await client.listPolls();
    expect(polls).toHaveLength(2);
    expect(polls[0]!.id).toBe(0n);
    expect(polls[1]!.id).toBe(1n);
  });
});

describe("AL0Error", () => {
  it("has correct name and code", () => {
    const err = new AL0Error("test", "NOT_FOUND");
    expect(err.name).toBe("AL0Error");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("fromUnknown detects already-registered pattern", () => {
    const err = AL0Error.fromUnknown(new Error("swarm_id already registered"));
    expect(err.code).toBe("ALREADY_EXISTS");
  });

  it("fromUnknown detects expired pattern", () => {
    const err = AL0Error.fromUnknown(new Error("Poll expired"));
    expect(err.code).toBe("POLL_EXPIRED");
  });

  it("fromUnknown wraps plain strings", () => {
    const err = AL0Error.fromUnknown("something went wrong");
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.message).toBe("something went wrong");
  });

  it("fromUnknown passes through existing AL0Error unchanged", () => {
    const original = new AL0Error("original", "UNAUTHORIZED");
    expect(AL0Error.fromUnknown(original)).toBe(original);
  });
});

// ─── API-key mode tests ────────────────────────────────────────────────────────

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    })
  );
}

function mockFetchError(status: number, errorMessage?: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () =>
        Promise.resolve(errorMessage ? { error: errorMessage } : {}),
    })
  );
}

describe("AL0Client — apiKey mode: registerAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls relay POST /api/relay/register and returns typed result", async () => {
    mockFetchOk({ swarm_id: "relay-swarm", appId: "1001" });
    const client = makeApiKeyClient();
    const result = await client.registerAgent({ swarmId: "relay-swarm" });
    expect(result).toEqual({ swarmId: "relay-swarm", registryAppId: 1001n });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://relay.example.com/api/relay/register",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws ALREADY_EXISTS on HTTP 409", async () => {
    mockFetchError(409, "swarmId already registered");
    const client = makeApiKeyClient();
    const err = await client
      .registerAgent({ swarmId: "dup" })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("ALREADY_EXISTS");
  });

  it("throws UNAUTHORIZED on HTTP 401", async () => {
    mockFetchError(401);
    const client = makeApiKeyClient();
    const err = await client
      .registerAgent({ swarmId: "s" })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("UNAUTHORIZED");
  });
});

describe("AL0Client — apiKey mode: createPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls relay POST /api/relay/createPoll and returns pollId as bigint", async () => {
    mockFetchOk({ pollId: "42" });
    const client = makeApiKeyClient();
    const result = await client.createPoll({
      swarmId: "s",
      question: "Q?",
      options: ["A", "B"],
      expiresAt: 9999999999,
    });
    expect(result).toEqual({ pollId: 42n });
  });

  it("throws RELAY_ERROR when pollId is missing from response", async () => {
    mockFetchOk({ unexpected: true });
    const client = makeApiKeyClient();
    const err = await client
      .createPoll({
        swarmId: "s",
        question: "Q?",
        options: ["A", "B"],
        expiresAt: 9999999999,
      })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("RELAY_ERROR");
  });
});

describe("AL0Client — apiKey mode: vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls relay POST /api/relay/vote and returns typed result", async () => {
    mockFetchOk({ poll_id: 5, option_index: 2 });
    const client = makeApiKeyClient();
    const result = await client.vote({ pollId: 5n, optionIndex: 2 });
    expect(result).toEqual({ pollId: 5n, optionIndex: 2 });
  });

  it("throws NOT_FOUND on HTTP 404", async () => {
    mockFetchError(404, "Poll not found");
    const client = makeApiKeyClient();
    const err = await client
      .vote({ pollId: 999n, optionIndex: 0 })
      .catch((e: unknown) => e as AL0Error);
    expect(err).toBeInstanceOf(AL0Error);
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("AL0Client — apiKey mode: getPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls relay GET and returns Poll with bigint fields coerced", async () => {
    mockFetchOk({
      id: "7",
      question: "Best option?",
      swarmId: "s1",
      creator: "ADDR",
      options: ["A", "B"],
      optionCount: 2,
      createdAt: "1000",
      expiresAt: "9999999999",
      isActive: true,
    });
    const client = makeApiKeyClient();
    const poll = await client.getPoll(7n);
    expect(poll.id).toBe(7n);
    expect(poll.createdAt).toBe(1000n);
    expect(poll.expiresAt).toBe(9999999999n);
    expect(poll.isActive).toBe(true);
    expect(poll.options).toEqual(["A", "B"]);
  });
});

describe("AL0Client — apiKey mode: getResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns PollResults with tallies as bigint array from relay", async () => {
    mockFetchOk({
      pollId: "3",
      tallies: ["10", "5", "2"],
      totalVotes: "17",
    });
    const client = makeApiKeyClient();
    const results = await client.getResults(3n);
    expect(results.pollId).toBe(3n);
    expect(results.tallies).toEqual([10n, 5n, 2n]);
    expect(results.totalVotes).toBe(17n);
  });
});

describe("AL0Client — apiKey mode: listPolls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls relay GET /api/relay/polls and returns Poll array with coerced bigints", async () => {
    const rawPoll = {
      id: "0",
      question: "Q",
      swarmId: "s",
      creator: "ADDR",
      options: ["A", "B"],
      optionCount: 2,
      createdAt: "1000",
      expiresAt: "9999999999",
      isActive: false,
    };
    mockFetchOk([rawPoll]);
    const client = makeApiKeyClient();
    const polls = await client.listPolls();
    expect(polls).toHaveLength(1);
    expect(polls[0]!.id).toBe(0n);
    expect(polls[0]!.expiresAt).toBe(9999999999n);
    expect(polls[0]!.isActive).toBe(false);
  });

  it("returns empty array when relay returns []", async () => {
    mockFetchOk([]);
    const client = makeApiKeyClient();
    const polls = await client.listPolls();
    expect(polls).toEqual([]);
  });
});
