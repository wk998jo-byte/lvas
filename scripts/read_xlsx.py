"""Minimal xlsx reader (no external deps) used to inspect the asset master file."""

import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def col_to_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref).group(0)
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def load_shared_strings(zf: zipfile.ZipFile):
    try:
        data = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    out = []
    for si in root.findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    return out


def sheet_names(zf: zipfile.ZipFile):
    root = ET.fromstring(zf.read("xl/workbook.xml"))
    return [s.get("name") for s in root.iter(f"{{{NS['m']}}}sheet")]


def read_sheet(zf: zipfile.ZipFile, sheet_idx: int, shared):
    path = f"xl/worksheets/sheet{sheet_idx}.xml"
    root = ET.fromstring(zf.read(path))
    rows = []
    for row in root.iter(f"{{{NS['m']}}}row"):
        values = {}
        for c in row.findall("m:c", NS):
            ref = c.get("r") or "A1"
            ci = col_to_index(ref)
            ctype = c.get("t")
            v = c.find("m:v", NS)
            is_node = c.find("m:is", NS)
            if ctype == "s" and v is not None:
                text = shared[int(v.text)]
            elif ctype == "inlineStr" and is_node is not None:
                text = "".join(t.text or "" for t in is_node.iter(f"{{{NS['m']}}}t"))
            elif v is not None:
                text = v.text
            else:
                text = ""
            values[ci] = (text or "").strip()
        if values:
            width = max(values) + 1
            rows.append([values.get(i, "") for i in range(width)])
    return rows


def main():
    path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    with zipfile.ZipFile(path) as zf:
        names = sheet_names(zf)
        shared = load_shared_strings(zf)
        print("SHEETS:", names)
        for i, name in enumerate(names, start=1):
            rows = read_sheet(zf, i, shared)
            print(f"\n=== SHEET {i}: {name} ({len(rows)} rows) ===")
            for r in rows[:limit]:
                print(r)


if __name__ == "__main__":
    main()
