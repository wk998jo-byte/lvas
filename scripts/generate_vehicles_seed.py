"""Retired LMV-only seed entry point.

The old generator fabricated registrations and upserted by plate. That violates
the confirmed Door-primary, nullable-plate, insert-only company fleet policy.
Use audit-fleet-006.py and the guarded import-fleet-006.mjs preparation instead.
No workbook, database, or output file is changed by this entry point.
"""
import sys

if __name__ == "__main__":
    sys.exit(
        "Legacy LMV-only seed generation is disabled: it fabricated plates. "
        "Use audit-fleet-006.py with the complete workbook and a fresh read-only "
        "snapshot, then review import-fleet-006.mjs. Production execution is "
        "not authorized or supported by this preparation CLI."
    )
