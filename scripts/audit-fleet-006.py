"""Read ALL workbook sheets; prepare, never execute, a Door-keyed fleet import.

python -B scripts/audit-fleet-006.py workbook.xlsx production.json output-dir
Only vehicle fields are exported; operator names/contact information are excluded.
"""
import argparse
import collections
import csv
import hashlib
import json
import pathlib
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET

from read_xlsx import load_shared_strings, col_to_index

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
AR2EN = dict(zip("ابحدرسصطعقكلمنهوي", "ABJDRSXTEGKLZNHUV"))
AR2EN["أ"] = "A"
EMPTY = {"", "-", "na", "n/a", "none", "null", "unknown", "#n/a", "#ref!", "#value!", "#div/0!"}
# The official workbook includes 006-01-1000 onwards; do not truncate/reject
# four-digit suffixes based only on the previous 325-vehicle import.
DOOR = re.compile(r"^006-\d{2}-\d{3,}$")


def clean(value):
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return None if value.lower() in EMPTY else value


def plate(raw):
    raw = clean(raw)
    if not raw:
        return None
    match = re.fullmatch(r"(\d{1,4})[-\s]*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])", raw)
    if match:
        return f"{int(match[1])}-{''.join(match.groups()[1:]).upper()}"
    # Exact three letters / one digit group only; never invent a registration.
    digits = re.findall(r"\d+", raw)
    letters = [AR2EN[c] for c in raw if c in AR2EN]
    if len(digits) == 1 and len(digits[0]) <= 4 and len(letters) == 3:
        return f"{int(digits[0])}-{''.join(reversed(letters))}"
    return None


def workbook_rows(filename):
    with zipfile.ZipFile(filename) as z:
        shared = load_shared_strings(z)
        relationships = {
            r.attrib["Id"]: r.attrib["Target"]
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        }
        sheets = ET.fromstring(z.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS)
        for sheet in sheets:
            target = relationships[sheet.attrib[f"{{{REL}}}id"]]
            path = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            header = None
            records = []
            for row in ET.fromstring(z.read(path)).findall("m:sheetData/m:row", NS):
                cells = {}
                for c in row.findall("m:c", NS):
                    v = c.find("m:v", NS)
                    value = v.text if v is not None else ""
                    if c.get("t") == "s":
                        value = shared[int(value)]
                    elif c.get("t") == "inlineStr":
                        value = "".join(t.text or "" for t in c.findall(".//m:t", NS))
                    cells[col_to_index(c.get("r"))] = clean(value)
                if not any(cells.values()):
                    continue
                if header is None:
                    header = {i: name for i, name in cells.items() if name}
                else:
                    records.append((int(row.get("r")), {name: cells.get(i) for i, name in header.items()}))
            yield sheet.get("name"), records


def normalize(sheet, row, data):
    def get(*names):
        return next((data[n] for n in names if data.get(n)), None)
    door = get("Asset No.", "Asset Number", "Door Number")
    if not door or not door.startswith("006-"):
        return None
    english = get("Registration Plates")
    arabic = get("Registration Plates Arabic", "Plate No Arabic")
    english_plate, arabic_plate = plate(english), plate(arabic)
    conflicts = []
    if english and not english_plate and english != door:
        conflicts.append({"field": "unrecognized_plate", "values": [english]})
    if english_plate and arabic_plate and english_plate != arabic_plate:
        conflicts.append({"field": "english_arabic_plate", "values": [english_plate, arabic_plate]})
    year_raw = get("MFG Year", "Mfg.Year", "Asset Mfg.Year")
    year = None
    if year_raw:
        try:
            value = float(year_raw)
            if value.is_integer() and 1980 <= value <= 2100:
                year = int(value)
            else:
                conflicts.append({"field": "year_out_of_range", "values": [year_raw]})
        except ValueError:
            conflicts.append({"field": "unrecognized_year", "values": [year_raw]})
    return {
        "door_number": door, "plate_number": english_plate or arabic_plate,
        "make": get("Manufacturer"), "model": get("Model Type"),
        "year": year, "category": get("Main Category", "Asset Type", "Asset Category"),
        "status": get("Status") or "UNKNOWN",
        "chassis": get("Asset Chassis No.", "Aset Chassis No."),
        "source_sheet": sheet, "source_row": row,
        "plate_provenance": "english" if english_plate else "arabic" if arabic_plate else None,
        "raw_plate_english": english, "raw_plate_arabic": arabic,
        "door_used_as_plate": english == door or arabic == door,
        "conflicts": conflicts,
    }


def equivalent(value):
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


def build_audit(filename, production):
    records, sheet_counts = [], []
    for sheet, rows in workbook_rows(filename):
        selected = [r for row, data in rows if (r := normalize(sheet, row, data))]
        records.extend(selected)
        sheet_counts.append({"sheet": sheet, "data_rows": len(rows), "006_rows": len(selected),
                             "006_unique": len({r["door_number"] for r in selected})})
    grouped = collections.defaultdict(list)
    for r in records:
        grouped[r["door_number"]].append(r)
    prod_doors = {r["door_number"]: r for r in production if r.get("door_number")}
    prod_plates = {r["plate_number"]: r for r in production if r.get("plate_number")}
    candidates = []
    for door, sources in sorted(grouped.items()):
        conflicts = [dict(c, source_sheet=s["source_sheet"], source_row=s["source_row"])
                     for s in sources for c in s["conflicts"]]
        c = {"door_number": door, "sources": sources, "conflicts": conflicts}
        for field in ("plate_number", "make", "model", "year", "chassis"):
            values = {equivalent(s[field]): s[field] for s in sources if s[field] is not None}
            c[field] = next(iter(values.values())) if len(values) == 1 else None
            if len(values) > 1:
                conflicts.append({"field": field, "values": sorted(values.values(), key=str),
                                  "references": [f'{s["source_sheet"]}!{s["source_row"]}' for s in sources]})
        c["category"] = sorted({s["category"] for s in sources if s["category"]})
        statuses = sorted({s["status"] for s in sources if s["status"] != "UNKNOWN"})
        c["status"] = statuses[0] if len(statuses) == 1 else "UNKNOWN"
        if len(statuses) > 1:
            conflicts.append({"field": "status", "values": statuses})
        # is_active is an availability decision, not an invented source status.
        # No availability is guessed. The execution plan must explicitly approve it.
        c["is_active"] = None
        same_sheet = collections.Counter(s["source_sheet"] for s in sources)
        c["same_sheet_duplicate"] = any(n > 1 for n in same_sheet.values())
        existing = prod_doors.get(door)
        if existing:
            c["production_id"] = existing["id"]
            for field in ("plate_number", "make", "model", "year"):
                if c[field] is not None and existing.get(field) is not None and equivalent(c[field]) != equivalent(existing[field]):
                    conflicts.append({"field": f"production_{field}", "source": c[field], "production": existing[field]})
            chassis_match = re.search(r"(?:^|\|)\s*Chassis:\s*([^|]+)", existing.get("notes") or "")
            if c["chassis"] and chassis_match and equivalent(c["chassis"]) != equivalent(chassis_match[1]):
                conflicts.append({"field": "production_chassis", "source": c["chassis"], "production": chassis_match[1].strip()})
            c["classification"] = "ALREADY EXISTS"
        elif not DOOR.fullmatch(door):
            conflicts.append({"field": "invalid_door", "values": [door]})
            c["classification"] = "MISSING — CONFLICT / NEEDS REVIEW"
        elif c["same_sheet_duplicate"]:
            c["classification"] = "DUPLICATE SOURCE DOOR NUMBER"
        else:
            if not any(s["make"] for s in sources) or not any(s["model"] for s in sources):
                conflicts.append({"field": "missing_make_model"})
            if c["plate_number"] in prod_plates:
                conflicts.append({"field": "production_plate_owner",
                                  "production_door": prod_plates[c["plate_number"]]["door_number"]})
            c["classification"] = "MISSING — CONFLICT / NEEDS REVIEW" if conflicts else "MISSING — READY TO IMPORT"
        candidates.append(c)
    # Detect shared supplied plates and chassis between DIFFERENT source doors.
    for field in ("plate_number", "chassis"):
        owners = collections.defaultdict(set)
        for r in records:
            if r[field]:
                owners[equivalent(r[field])].add(r["door_number"])
        for c in candidates:
            implicated = {d for s in c["sources"] if s[field]
                          for d in owners[equivalent(s[field])] if d != c["door_number"]}
            if implicated:
                c["conflicts"].append({"field": f"source_{field}_owners", "other_doors": sorted(implicated)})
                if c["classification"] != "ALREADY EXISTS":
                    c["classification"] = "MISSING — CONFLICT / NEEDS REVIEW"
    first_seen = set()
    classification = {c["door_number"]: c["classification"] for c in candidates}
    for r in records:
        r["classification"] = "DUPLICATE SOURCE DOOR NUMBER" if r["door_number"] in first_seen else classification[r["door_number"]]
        first_seen.add(r["door_number"])
    missing = [c for c in candidates if c["door_number"] not in prod_doors]
    ready = [c for c in missing if c["classification"] == "MISSING — READY TO IMPORT"]
    duplicate_doors = sorted(d for d, s in grouped.items() if len(s) > 1)
    production_review = []
    for r in production:
        issues = []
        if not r.get("door_number"):
            issues.append("Missing Door Number; not attributable to the 006 fleet")
        if (r.get("plate_number") or "").startswith("006-"):
            issues.append("Door Number used as a placeholder registration plate; preserve stored value, review real registration")
        if not r.get("plate_number"):
            issues.append("Missing registration plate")
        if r.get("year") is None:
            issues.append("Missing year")
        if (r.get("make") or "").lower() in {"", "unknown", "eeee"} or (r.get("model") or "").lower() in {"", "unknown", "eeee"}:
            issues.append("Missing or placeholder make/model")
        if issues:
            production_review.append({k: r.get(k) for k in ("id", "door_number", "plate_number", "make", "model", "year")} | {"issues": issues})
    return {
        "workbook": pathlib.Path(filename).name,
        "workbook_sha256": hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest(),
        "production_snapshot_sha256": hashlib.sha256(json.dumps(production, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "sheet_counts": sheet_counts, "source_records": records, "candidates": candidates,
        "ready_records": ready,
        "production_review": production_review,
        "summary": {
            "unique_006": len(candidates), "source_006_rows": len(records),
            "production_vehicles": len(production), "production_006": sum(bool(r.get("door_number", "") and r["door_number"].startswith("006-")) for r in production),
            "already_exists": len(candidates) - len(missing), "missing": len(missing),
            "ready": len(ready), "need_review": len(missing) - len(ready),
            "duplicate_source_doors": len(duplicate_doors),
            "same_sheet_duplicate_doors": sum(c["same_sheet_duplicate"] for c in candidates),
            "source_door_used_as_plate": sorted({r["door_number"] for r in records if r["door_used_as_plate"]}),
            "production_only": sorted(d for d in prod_doors if d.startswith("006-") and d not in grouped),
            "missing_with_plate": sum(any(s["plate_number"] is not None for s in c["sources"]) for c in missing),
            "missing_without_plate": sum(all(s["plate_number"] is None for s in c["sources"]) for c in missing),
            "missing_year": sum(all(s["year"] is None for s in c["sources"]) for c in missing),
            "missing_make_model": sum(not any(s["make"] for s in c["sources"]) or not any(s["model"] for s in c["sources"]) for c in missing),
            "unresolved_plate": sum(c["plate_number"] is None for c in missing),
            "unresolved_year": sum(c["year"] is None for c in missing),
            "status_known": sum(c["status"] != "UNKNOWN" for c in missing),
            "status_unknown": sum(c["status"] == "UNKNOWN" for c in missing),
            "conflict_doors": sum(bool(c["conflicts"]) for c in candidates),
            "conflict_items": sum(len(c["conflicts"]) for c in candidates),
        },
    }


def write_outputs(audit, output):
    output.mkdir(parents=True, exist_ok=True)
    for name, data in [("audit.json", audit), ("ready.json", audit["ready_records"]),
                       ("source-records.json", audit["source_records"])]:
        (output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    with (output / "candidates.csv").open("w", newline="") as f:
        columns = ["door_number", "plate_number", "make", "model", "year", "status", "classification", "source_references", "conflicts"]
        writer = csv.DictWriter(f, columns)
        writer.writeheader()
        for c in audit["candidates"]:
            row = {k: c.get(k) for k in columns}
            row["source_references"] = "; ".join(f'{s["source_sheet"]}!{s["source_row"]}' for s in c["sources"])
            row["conflicts"] = json.dumps(c["conflicts"], ensure_ascii=False)
            writer.writerow(row)
    with (output / "identity-conflicts.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["door_number", "conflict_number", "source_references", "plate_number", "make", "model", "details"])
        for c in audit["candidates"]:
            for n, conflict in enumerate(c["conflicts"], 1):
                refs = "; ".join(f'{s["source_sheet"]}!{s["source_row"]}' for s in c["sources"])
                writer.writerow([c["door_number"], n, refs, c["plate_number"], c["make"], c["model"],
                                 json.dumps(conflict, ensure_ascii=False)])
    lines = [f'# Complete 006 fleet audit — {audit["workbook"]}', "",
             "Source duplicates include overlapping sheets. Consistent cross-sheet",
             "corroboration is deduplicated; same-sheet duplicates and true identity",
             "conflicts are not resolved automatically. All import availability",
             "decisions require a separately approved Door-keyed activation plan.", "",
             "## Summary", "```json", json.dumps(audit["summary"], indent=2), "```",
             "", "## Every identity conflict"]
    for c in audit["candidates"]:
        if c["conflicts"]:
            lines += [f'\n### {c["door_number"]} — {c["classification"]}']
            lines += [f"- {json.dumps(conflict, ensure_ascii=False)}" for conflict in c["conflicts"]]
    lines += ["", "## Every missing source vehicle",
              "| Door | Plate | Make | Model | Year | Status | Classification | Source |",
              "|---|---|---|---|---|---|---|---|"]
    for c in audit["candidates"]:
        if c["classification"] != "ALREADY EXISTS":
            fields = [c["door_number"], c["plate_number"], c["make"], c["model"], c["year"], c["status"], c["classification"],
                      "; ".join(f'{s["source_sheet"]}!{s["source_row"]}' for s in c["sources"])]
            lines.append("| " + " | ".join(str(v if v is not None else "Unavailable").replace("|", "/") for v in fields) + " |")
    lines += ["", "## Existing Production placeholder/incomplete records"]
    lines += [f"- {json.dumps(r, ensure_ascii=False)}" for r in audit["production_review"]]
    (output / "audit-report.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook")
    parser.add_argument("production_snapshot")
    parser.add_argument("output_directory")
    args = parser.parse_args()
    audit = build_audit(args.workbook, json.loads(pathlib.Path(args.production_snapshot).read_text()))
    write_outputs(audit, pathlib.Path(args.output_directory))
    print(json.dumps({"sheets": audit["sheet_counts"], "summary": audit["summary"]}, indent=2))
