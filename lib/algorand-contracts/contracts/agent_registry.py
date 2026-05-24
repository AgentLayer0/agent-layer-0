"""
AgentRegistry — ARC-4 contract for swarm registration on Agent Layer 0.

Swarm owners call `register_swarm` to claim a unique swarm ID on-chain.
The registry stores (swarm_id -> SwarmRecord) in box storage.
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


class SwarmRecord(arc4.Struct):
    owner: arc4.Address
    registered_at: arc4.UInt64


class AgentRegistry(ARC4Contract):
    """
    On-chain registry for Agent Layer 0 swarms.

    Box storage layout:
      Key  : swarm_id (arc4.String)
      Value: SwarmRecord { owner: Address, registered_at: UInt64 }
    """

    def __init__(self) -> None:
        self.swarms: BoxMap[arc4.String, SwarmRecord] = BoxMap(
            arc4.String, SwarmRecord, key_prefix=b"s:"
        )
        self.total_swarms: UInt64 = UInt64(0)

    @arc4.abimethod
    def register_swarm(self, swarm_id: arc4.String) -> arc4.UInt64:
        """
        Register a new swarm. Caller becomes the owner.

        Args:
            swarm_id: Unique identifier string (max 64 bytes).

        Returns:
            The current application ID (on-chain reference for the caller).
        """
        assert swarm_id.bytes.length <= UInt64(64), "swarm_id too long (max 64 bytes)"
        assert swarm_id not in self.swarms, "swarm_id already registered"

        record = SwarmRecord(
            owner=arc4.Address(Txn.sender),
            registered_at=arc4.UInt64(Global.latest_timestamp),
        )
        self.swarms[swarm_id] = record.copy()
        self.total_swarms += UInt64(1)

        log(b"AL0:REGISTRY:REGISTER")

        return arc4.UInt64(Global.current_application_id.id)

    @arc4.abimethod(readonly=True)
    def get_owner(self, swarm_id: arc4.String) -> arc4.Address:
        """Return the owner address for a registered swarm."""
        assert swarm_id in self.swarms, "swarm_id not registered"
        return arc4.Address(self.swarms[swarm_id].owner.native)

    @arc4.abimethod(readonly=True)
    def is_registered(self, swarm_id: arc4.String) -> arc4.Bool:
        """Check whether a swarm ID is registered."""
        return arc4.Bool(swarm_id in self.swarms)

    @arc4.abimethod(readonly=True)
    def get_total_swarms(self) -> arc4.UInt64:
        """Return the total number of registered swarms."""
        return arc4.UInt64(self.total_swarms)
