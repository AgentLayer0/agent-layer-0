"""
Build script — compiles all three Algorand Python contracts using puyapy 3.5.0.

Usage:
    python3.12 build.py

Output: writes compiled artifacts to ./artifacts/<snake_case_name>/
  - <ContractName>.arc32.json  (ABI + contract metadata, ARC-32 format)
  - <ContractName>.approval.teal
  - <ContractName>.clear.teal
  - <ContractName>.approval.puya.map  (source map)
  - <ContractName>.clear.puya.map

Compiler: python3.12 -m puyapy  (package: puyapy 3.5.0, NOT puya 0.x)
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
CONTRACTS = ROOT / "contracts"
ARTIFACTS = ROOT / "artifacts"

CONTRACT_FILES = [
    CONTRACTS / "agent_registry.py",
    CONTRACTS / "poll_factory.py",
    CONTRACTS / "ballot_box.py",
]


def build() -> None:
    ARTIFACTS.mkdir(exist_ok=True)

    print("Building Algorand Python contracts with puya...")

    for contract_file in CONTRACT_FILES:
        print(f"  Compiling {contract_file.name}...")
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "puyapy",
                "--out-dir",
                str(ARTIFACTS / contract_file.stem),
                str(contract_file),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr}", file=sys.stderr)
            sys.exit(result.returncode)
        print(f"  OK → artifacts/{contract_file.stem}/")

    print("Build complete.")


if __name__ == "__main__":
    build()
