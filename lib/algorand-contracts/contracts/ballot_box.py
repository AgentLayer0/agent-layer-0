"""
BallotBox — ARC-4 contract for recording votes on Agent Layer 0 polls.

After deployment, call `bootstrap(factory_app_id)` once to link this contract
to the PollFactory.

Poll initialisation (`init_poll`) fetches authoritative metadata directly from
PollFactory via inner transaction, so poll expiry and option counts cannot be
spoofed by the caller.

Agents cast one vote per poll. Votes are rejected if:
  - The poll has not been initialised in this BallotBox
  - The poll has expired (checked against locally cached expiry)
  - option_index is out of range
  - The caller has already voted on this poll
"""

from algopy import (
    ARC4Contract,
    BoxMap,
    Global,
    Txn,
    UInt64,
    arc4,
    log,
    subroutine,
)


class VoteRecord(arc4.Struct):
    option_index: arc4.UInt64


class TallyRecord(arc4.Struct):
    tally_0: arc4.UInt64
    tally_1: arc4.UInt64
    tally_2: arc4.UInt64
    tally_3: arc4.UInt64
    tally_4: arc4.UInt64
    tally_5: arc4.UInt64
    tally_6: arc4.UInt64
    tally_7: arc4.UInt64


class PollMeta(arc4.Struct):
    """
    Locally cached poll metadata fetched from PollFactory at init_poll time.

    ABI encoding: (uint64,uint64) — matches PollFactory.get_poll_meta return type.
    """

    expires_at: arc4.UInt64
    option_count: arc4.UInt64


class BallotBox(ARC4Contract):
    """
    Vote recorder for Agent Layer 0 governance polls.

    Global state:
      total_votes     : uint64
      factory_app_id  : uint64 — PollFactory application ID (set via bootstrap)

    Box storage layout:
      poll_meta — key: b"m:" + poll_id  →  PollMeta { expires_at, option_count }
      votes     — key: b"v:" + poll_id (8 bytes) + voter (32 bytes) → VoteRecord
      tallies   — key: b"t:" + poll_id  →  TallyRecord (8 × UInt64)
    """

    def __init__(self) -> None:
        self.total_votes: UInt64 = UInt64(0)
        self.factory_app_id: UInt64 = UInt64(0)
        self.poll_meta: BoxMap[arc4.UInt64, PollMeta] = BoxMap(
            arc4.UInt64, PollMeta, key_prefix=b"m:"
        )
        self.tallies: BoxMap[arc4.UInt64, TallyRecord] = BoxMap(
            arc4.UInt64, TallyRecord, key_prefix=b"t:"
        )

    @arc4.abimethod
    def bootstrap(self, factory_app_id: arc4.UInt64) -> None:
        """
        Link this contract to the PollFactory.

        Must be called once by the contract creator after deployment, before
        any polls can be initialised.

        Args:
            factory_app_id: Application ID of the deployed PollFactory contract.
        """
        assert Txn.sender == Global.creator_address, "only creator can bootstrap"
        assert self.factory_app_id == UInt64(0), "already bootstrapped"
        assert factory_app_id.native > UInt64(0), "invalid factory app id"
        self.factory_app_id = factory_app_id.native

    @arc4.abimethod
    def init_poll(self, poll_id: arc4.UInt64) -> None:
        """
        Register a poll so that votes can be cast against it.

        Fetches authoritative `expires_at` and `option_count` from PollFactory
        via inner transaction — the caller cannot spoof these values.

        Typically called as a group transaction alongside
        PollFactory.create_poll, immediately after the poll is created.

        Args:
            poll_id: The poll ID assigned by PollFactory.create_poll.
        """
        assert self.factory_app_id > UInt64(0), "not bootstrapped"
        assert poll_id not in self.poll_meta, "poll already initialised"

        # ── Fetch authoritative metadata from PollFactory ─────────────────────
        meta, _txn = arc4.abi_call[PollMeta](
            "get_poll_meta(uint64)(uint64,uint64)",
            poll_id,
            app_id=self.factory_app_id,
        )
        # Verify the fetched poll is still active (not already expired at init time)
        assert meta.expires_at.native > Global.latest_timestamp, "poll already expired"

        self.poll_meta[poll_id] = meta.copy()

        zero = arc4.UInt64(0)
        tally = TallyRecord(
            tally_0=zero,
            tally_1=zero,
            tally_2=zero,
            tally_3=zero,
            tally_4=zero,
            tally_5=zero,
            tally_6=zero,
            tally_7=zero,
        )
        self.tallies[poll_id] = tally.copy()

        log(b"AL0:BALLOT:INIT_POLL")

    @arc4.abimethod
    def cast_vote(self, poll_id: arc4.UInt64, option_index: arc4.UInt64) -> None:
        """
        Cast one vote on a poll.

        Args:
            poll_id      : ID of the target poll (must be initialised via init_poll).
            option_index : Zero-based index into the poll's options array.

        Reverts if:
          - Poll has not been initialised
          - Poll has expired
          - option_index >= poll's option_count
          - Caller already voted on this poll
        """
        assert poll_id in self.poll_meta, "poll not initialised"

        meta = self.poll_meta[poll_id].copy()
        assert meta.expires_at.native > Global.latest_timestamp, "poll has expired"
        assert option_index.native < meta.option_count.native, "invalid option index"

        voter = arc4.Address(Txn.sender)
        vote_box_key = b"v:" + poll_id.bytes + voter.bytes
        from algopy import op
        _existing, already_voted = op.Box.get(vote_box_key)
        assert not already_voted, "already voted"

        vote = VoteRecord(option_index=option_index)
        op.Box.put(vote_box_key, vote.bytes)

        self._increment_tally(poll_id, option_index.native)
        self.total_votes += UInt64(1)

        log(b"AL0:BALLOT:VOTE")

    @arc4.abimethod(readonly=True)
    def get_tally(self, poll_id: arc4.UInt64) -> TallyRecord:
        """Return the full tally record for a poll."""
        assert poll_id in self.tallies, "poll not found"
        return self.tallies[poll_id].copy()

    @arc4.abimethod(readonly=True)
    def has_voted(self, poll_id: arc4.UInt64, voter: arc4.Address) -> arc4.Bool:
        """Return true if the given voter has already cast a vote on this poll."""
        vote_box_key = b"v:" + poll_id.bytes + voter.bytes
        from algopy import op
        _value, exists = op.Box.get(vote_box_key)
        return arc4.Bool(exists)

    @arc4.abimethod(readonly=True)
    def get_vote(self, poll_id: arc4.UInt64, voter: arc4.Address) -> arc4.UInt64:
        """Return the option index a voter chose (reverts if not voted)."""
        vote_box_key = b"v:" + poll_id.bytes + voter.bytes
        from algopy import op
        vote_bytes, exists = op.Box.get(vote_box_key)
        assert exists, "voter has not voted on this poll"
        record = VoteRecord.from_bytes(vote_bytes)
        return record.option_index

    @arc4.abimethod(readonly=True)
    def get_total_votes(self) -> arc4.UInt64:
        """Return the total number of votes ever cast across all polls."""
        return arc4.UInt64(self.total_votes)

    @arc4.abimethod(readonly=True)
    def get_factory_app_id(self) -> arc4.UInt64:
        """Return the linked PollFactory application ID."""
        return arc4.UInt64(self.factory_app_id)

    @subroutine
    def _increment_tally(self, poll_id: arc4.UInt64, option_index: UInt64) -> None:
        """Increment the tally counter for the chosen option."""
        tally = self.tallies[poll_id].copy()

        if option_index == UInt64(0):
            tally.tally_0 = arc4.UInt64(tally.tally_0.native + UInt64(1))
        elif option_index == UInt64(1):
            tally.tally_1 = arc4.UInt64(tally.tally_1.native + UInt64(1))
        elif option_index == UInt64(2):
            tally.tally_2 = arc4.UInt64(tally.tally_2.native + UInt64(1))
        elif option_index == UInt64(3):
            tally.tally_3 = arc4.UInt64(tally.tally_3.native + UInt64(1))
        elif option_index == UInt64(4):
            tally.tally_4 = arc4.UInt64(tally.tally_4.native + UInt64(1))
        elif option_index == UInt64(5):
            tally.tally_5 = arc4.UInt64(tally.tally_5.native + UInt64(1))
        elif option_index == UInt64(6):
            tally.tally_6 = arc4.UInt64(tally.tally_6.native + UInt64(1))
        else:
            tally.tally_7 = arc4.UInt64(tally.tally_7.native + UInt64(1))

        self.tallies[poll_id] = tally.copy()
