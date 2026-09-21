"""Convert the BQ employee master sheet into scripts/employees.json.

Usage:
    python scripts/generate_employees_seed.py "C:/path/BQ EMP list.xlsx"

Category is derived from the POSITION column:
    *manager*    -> manager_requester
    *supervisor* -> supervisor_requester
    everything else -> other_employee
"""

import json
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import read_xlsx as rx  # noqa: E402

SHEET_NAME = "BQ EMP"
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "employees.json")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def category(position: str) -> str:
    lowered = position.lower()
    if "manager" in lowered:
        return "manager_requester"
    if "supervisor" in lowered:
        return "supervisor_requester"
    return "other_employee"


def main() -> None:
    path = sys.argv[1]
    with zipfile.ZipFile(path) as zf:
        names = rx.sheet_names(zf)
        if SHEET_NAME not in names:
            raise SystemExit(f"Sheet {SHEET_NAME!r} not found in {names}")
        shared = rx.load_shared_strings(zf)
        rows = rx.read_sheet(zf, names.index(SHEET_NAME) + 1, shared)

    header = [clean(c).lower() for c in rows[0]]
    idx = {name: header.index(name) for name in header if name}

    def cell(row, key):
        i = idx.get(key)
        return clean(row[i]) if i is not None and i < len(row) else ""

    employees = {}
    skipped = 0

    for row in rows[1:]:
        badge = digits(cell(row, "badge"))
        full_name = cell(row, "hr_candidate_full_name")
        if not badge or not full_name:
            skipped += 1
            continue

        position = cell(row, "position")
        employees[badge] = {
            "badge": badge,
            "full_name": full_name,
            "national_id": digits(cell(row, "id")) or None,
            "mobile": digits(cell(row, "mobile")) or None,
            "department": cell(row, "department") or None,
            "position": position or None,
            "role": category(position),
        }

    payload = sorted(employees.values(), key=lambda e: int(e["badge"]))

    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)

    counts = {}
    for employee in payload:
        counts[employee["role"]] = counts.get(employee["role"], 0) + 1

    print(f"wrote {len(payload)} employees to {OUT_PATH} (skipped {skipped})")
    for role, count in sorted(counts.items()):
        print(f"  {role}: {count}")


if __name__ == "__main__":
    main()
