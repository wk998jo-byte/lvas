"""Generate the Supabase seed migration for light vehicles from the LMV sheet.

Usage: python scripts/generate_vehicles_seed.py <path-to-xlsx> <output-sql>
"""

import io
import json
import os
import re
import sys
import zipfile
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from read_xlsx import load_shared_strings, read_sheet, sheet_names  # noqa: E402

PLATE_RE = re.compile(r"^\s*(\d{1,4})\s*[-\s]?\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])\s*$")
INACTIVE_STATUSES = {"under repair", "unusable", "under checkup"}

# Official Saudi plate letter equivalents. Arabic plates are written right-to-left,
# so the letter order is reversed relative to the Latin rendering.
AR2EN = {
    "أ": "A", "ا": "A", "ب": "B", "ح": "J", "د": "D", "ر": "R", "س": "S",
    "ص": "X", "ط": "T", "ع": "E", "ق": "G", "ك": "K", "ل": "L", "م": "Z",
    "ن": "N", "ه": "H", "و": "U", "ي": "V",
}


def plate_from_arabic(raw):
    """Return a Latin plate like '7792-RXB' derived from an Arabic plate, or None."""
    if not raw:
        return None
    digits = re.findall(r"\d+", raw)
    letters = [ch for ch in raw if ch in AR2EN]
    if not digits or len(letters) < 3:
        return None
    number = digits[0].lstrip("0") or "0"
    if len(number) > 4:
        return None
    latin = "".join(AR2EN[ch] for ch in letters[:3][::-1])
    return f"{number}-{latin}"


def q(value):
    if value is None or value == "":
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def clean(value):
    return re.sub(r"\s+", " ", (value or "").strip())


def parse_year(raw):
    raw = clean(raw)
    if not raw:
        return None
    try:
        year = int(float(raw))
    except ValueError:
        return None
    return year if 1980 <= year <= 2100 else None


def main():
    xlsx_path, out_path = sys.argv[1], sys.argv[2]

    with zipfile.ZipFile(xlsx_path) as zf:
        names = sheet_names(zf)
        rows = read_sheet(zf, names.index("LMV") + 1, load_shared_strings(zf))

    header = rows[0]
    ix = {name: i for i, name in enumerate(header)}

    def g(row, name):
        i = ix.get(name, -1)
        return clean(row[i]) if 0 <= i < len(row) else ""

    vehicles = []
    seen_assets = set()
    seen_plates = set()
    skipped = []

    for row in rows[1:]:
        asset_no = g(row, "Asset No.")
        if not asset_no or asset_no in seen_assets:
            if asset_no:
                skipped.append((asset_no, "duplicate asset no"))
            continue
        seen_assets.add(asset_no)

        raw_plate = g(row, "Registration Plates")
        raw_plate_ar = g(row, "Registration Plates Arabic")
        match = PLATE_RE.match(raw_plate)
        derived = None
        if match:
            digits, a, b, c = match.groups()
            plate = f"{digits.lstrip('0') or '0'}-{a}{b}{c}".upper()
            plate_source = "english"
        else:
            derived = plate_from_arabic(raw_plate_ar)
            plate = derived or asset_no
            plate_source = "arabic" if derived else "asset"

        if plate in seen_plates:
            # Another asset already claims this plate (the source file has a few
            # mismatched English/Arabic pairs) - keep the row under its asset number.
            collided, plate, plate_source = plate, asset_no, "asset"
            if plate in seen_plates:
                skipped.append((asset_no, f"duplicate plate {collided}"))
                continue
            note_collision = f"Source plate {collided} already used by another asset"
        else:
            note_collision = None
        seen_plates.add(plate)

        make = g(row, "Manufacturer") or "Unknown"
        model = g(row, "Model Type") or g(row, "Asset Type") or "Unknown"
        year = parse_year(g(row, "Mfg.Year"))
        status = g(row, "Status")
        is_active = status.lower() not in INACTIVE_STATUSES

        note_parts = [f"Asset No: {asset_no}"]
        for label, key in (
            ("Type", "Asset Type"),
            ("Sub type", "Sub Type"),
            ("Drive", "Capacity"),
            ("Status", "Status"),
            ("Division", "Assigned Division"),
            ("Location", "Location"),
            ("Client", "Long Term Client"),
            ("Chassis", "Asset Chassis No."),
            ("Plate (AR)", "Registration Plates Arabic"),
        ):
            value = g(row, key)
            if value:
                note_parts.append(f"{label}: {value}")
        if note_collision:
            note_parts.append(note_collision)
        if plate_source == "arabic":
            note_parts.append("Plate derived from the Arabic plate in the source file")
        elif plate_source == "asset":
            if raw_plate:
                note_parts.append(f"Raw plate in source: {raw_plate}")
            note_parts.append("No registration plate in source - using asset number")

        vehicles.append(
            {
                "plate": plate,
                "make": make,
                "model": model,
                "year": year,
                "is_active": is_active,
                "notes": " | ".join(note_parts),
                "source": plate_source,
            }
        )

    lines = [
        "-- Seed light vehicles (LMV fleet) imported from Asset Master For General Use.xlsx",
        "-- Source sheet: LMV. Vehicles without a registration plate in the source use their",
        "-- asset number as a temporary plate; update them once plates are issued.",
        "",
        "insert into public.vehicles (plate_number, make, model, year, is_active, notes)",
        "values",
    ]

    values = []
    for v in vehicles:
        year = v["year"] if v["year"] is not None else "null"
        values.append(
            f"  ({q(v['plate'])}, {q(v['make'])}, {q(v['model'])}, {year}, "
            f"{'true' if v['is_active'] else 'false'}, {q(v['notes'])})"
        )

    lines.append(",\n".join(values))
    lines.append("on conflict (plate_number) do update set")
    lines.append("  make = excluded.make,")
    lines.append("  model = excluded.model,")
    lines.append("  year = excluded.year,")
    lines.append("  is_active = excluded.is_active,")
    lines.append("  notes = excluded.notes;")
    lines.append("")

    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines))

    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "light-vehicles.json")
    payload = [
        {
            "plate_number": v["plate"],
            "make": v["make"],
            "model": v["model"],
            "year": v["year"],
            "is_active": v["is_active"],
            "notes": v["notes"],
        }
        for v in vehicles
    ]
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    counts = Counter(v["source"] for v in vehicles)
    print(f"vehicles written: {len(vehicles)}")
    print(f"  english plate   : {counts['english']}")
    print(f"  derived (arabic): {counts['arabic']}")
    print(f"  asset-no plate  : {counts['asset']}")
    print(f"  inactive        : {sum(1 for v in vehicles if not v['is_active'])}")
    print(f"  skipped         : {len(skipped)} -> {skipped}")


if __name__ == "__main__":
    main()
