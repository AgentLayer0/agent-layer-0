"""
PollFactory — ARC-4 contract for creating governance polls on Agent Layer 0.

After deployment, call `bootstrap(registry_app_id)` once to link this contract
to the AgentRegistry.  Thereafter, `create_poll` verifies that the caller is
the registered owner of the submitted `swarm_id` via an inner transaction to
AgentRegistry.
"""

from algopy import (
    ARC4Contract,
    BoxMap,
    Global,
    Txn,
    UInt64,
    arc4,
    log,
)


class PollMeta(arc4.Struct):
    """Lightweight summary of a poll returned for BallotBox cross-contract calls."""

    expires_at: arc4.UInt64
    option_count: arc4.UInt64


class PollRecord(arc4.Struct):
    creator: arc4.Address
    swarm_id: arc4.String
    question: arc4.String
    option_count: arc4.UInt64
    option_0: arc4.String
    option_1: arc4.String
    option_2: arc4.String
    option_3: arc4.String
    option_4: arc4.String
    option_5: arc4.String
    option_6: arc4.String
    option_7: arc4.String
    created_at: arc4.UInt64
    expires_at: arc4.UInt64


class PollFactory(ARC4Contract):
    """
    Factory for Agent Layer 0 governance polls.

    Global state:
      next_poll_id     : uint64 — monotonically increasing poll counter
      registry_app_id  : uint64 — AgentRegistry application ID (set via bootstrap)

    Box storage layout:
      Key  : poll_id (arc4.UInt64)
      Value: PollRecord struct
    """

    def __init__(self) -> None:
        self.next_poll_id: UInt64 = UInt64(0)
        self.registry_app_id: UInt64 = UInt64(0)
        self.polls: BoxMap[arc4.UInt64, PollRecord] = BoxMap(
            arc4.UInt64, PollRecord, key_prefix=b"p:"
        )

    @arc4.abimethod
    def bootstrap(self, registry_app_id: arc4.UInt64) -> None:
        """
        Link this contract to the AgentRegistry.

        Must be called once by the contract creator after deployment, before
        any polls can be created.

        Args:
            registry_app_id: Application ID of the deployed AgentRegistry contract.
        """
        assert Txn.sender == Global.creator_address, "only creator can bootstrap"
        assert self.registry_app_id == UInt64(0), "already bootstrapped"
        assert registry_app_id.native > UInt64(0), "invalid registry app id"
        self.registry_app_id = registry_app_id.native

    @arc4.abimethod
    def create_poll(
        self,
        swarm_id: arc4.String,
        question: arc4.String,
        option_0: arc4.String,
        option_1: arc4.String,
        option_2: arc4.String,
        option_3: arc4.String,
        option_4: arc4.String,
        option_5: arc4.String,
        option_6: arc4.String,
        option_7: arc4.String,
        option_count: arc4.UInt64,
        expires_at: arc4.UInt64,
    ) -> arc4.UInt64:
        """
        Create a new governance poll.

        The caller must be the registered owner of `swarm_id` in the linked
        AgentRegistry — verified via inner transaction.

        Args:
            swarm_id     : Caller's registered swarm ID.
            question     : Poll question string (max 256 bytes).
            option_0..7  : Option strings (unused slots should be empty "").
            option_count : Number of valid options (2–8).
            expires_at   : Unix timestamp after which no votes are accepted.

        Returns:
            Numeric poll ID (monotonically increasing).
        """
        assert self.registry_app_id > UInt64(0), "not bootstrapped"
        assert question.bytes.length <= UInt64(256), "question too long"
        n = option_count.native
        assert n >= UInt64(2), "at least 2 options required"
        assert n <= UInt64(8), "max 8 options"
        assert expires_at.native > Global.latest_timestamp, "expiry must be in the future"

        # ── Verify caller is the registered swarm owner ───────────────────────
        owner, _txn = arc4.abi_call[arc4.Address](
            "get_owner(string)address",
            swarm_id,
            app_id=self.registry_app_id,
        )
        assert owner.native == Txn.sender, "caller is not the registered swarm owner"

        poll_id = arc4.UInt64(self.next_poll_id)
        self.next_poll_id += UInt64(1)

        record = PollRecord(
            creator=arc4.Address(Txn.sender),
            swarm_id=swarm_id,
            question=question,
            option_count=option_count,
            option_0=option_0,
            option_1=option_1,
            option_2=option_2,
            option_3=option_3,
            option_4=option_4,
            option_5=option_5,
            option_6=option_6,
            option_7=option_7,
            created_at=arc4.UInt64(Global.latest_timestamp),
            expires_at=expires_at,
        )
        self.polls[poll_id] = record.copy()

        log(b"AL0:POLL:CREATE")

        return poll_id

    @arc4.abimethod(readonly=True)
    def get_poll(self, poll_id: arc4.UInt64) -> PollRecord:
        """Return the full poll record for a given poll ID."""
        assert poll_id in self.polls, "poll not found"
        return self.polls[poll_id].copy()

    @arc4.abimethod(readonly=True)
    def get_poll_meta(self, poll_id: arc4.UInt64) -> PollMeta:
        """
        Return the lightweight poll metadata (expires_at, option_count).

        Intended for cross-contract calls from BallotBox.init_poll so it can
        verify poll provenance and read authoritative expiry/count without
        parsing the full PollRecord.
        """
        assert poll_id in self.polls, "poll not found"
        record = self.polls[poll_id].copy()
        return PollMeta(
            expires_at=record.expires_at,
            option_count=record.option_count,
        )

    @arc4.abimethod(readonly=True)
    def is_active(self, poll_id: arc4.UInt64) -> arc4.Bool:
        """Return true if the poll exists and has not expired."""
        if poll_id not in self.polls:
            return arc4.Bool(False)
        return arc4.Bool(
            self.polls[poll_id].expires_at.native > Global.latest_timestamp
        )

    @arc4.abimethod(readonly=True)
    def get_next_poll_id(self) -> arc4.UInt64:
        """Return the next poll ID that will be assigned."""
        return arc4.UInt64(self.next_poll_id)

    @arc4.abimethod(readonly=True)
    def get_registry_app_id(self) -> arc4.UInt64:
        """Return the linked AgentRegistry application ID."""
        return arc4.UInt64(self.registry_app_id)
