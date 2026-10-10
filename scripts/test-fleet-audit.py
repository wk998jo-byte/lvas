"""Synthetic XML workbook tests: no database, real imports, or workspace writes."""
import importlib.util
import pathlib
import tempfile
import zipfile
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("audit", pathlib.Path(__file__).with_name("audit-fleet-006.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def fixture(path):
    ns = audit.NS["m"]
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml",
                   f'<workbook xmlns="{ns}" xmlns:r="{audit.REL}"><sheets>'
                   '<sheet name="Asset Master Data" sheetId="1" r:id="r1"/>'
                   '<sheet name="PUBLIC-TRANSPORT" sheetId="9" r:id="r9"/>'
                   '<sheet name="LMV" sheetId="3" r:id="r3"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<Relationships><Relationship Id="r1" Target="worksheets/sheet4.xml"/>'
                   '<Relationship Id="r9" Target="worksheets/sheet7.xml"/>'
                   '<Relationship Id="r3" Target="worksheets/sheet2.xml"/></Relationships>')
        head = ["Asset No.", "Manufacturer", "Model Type", "Registration Plates", "Status", "MFG Year", "Asset Chassis No."]
        sheets = {
            "sheet4.xml": [(1, head), (42, ["006-01-1000", "Toyota", "Hilux", "", "", "", "VIN-A"]),
                           (43, ["006-01-002", "#N/A", "", "", "", "#N/A", ""]),
                           (44, ["006-01-003", "Toyota", "A", "1234-ABC", "On Job", "2020", "VIN-B"])],
            "sheet7.xml": [(1, head), (15, ["006-01-004", "Toyota", "Bus", "", "", "", "VIN-C"]),
                           (16, ["006-01-004", "Ford", "Other", "", "", "", "VIN-D"])],
            "sheet2.xml": [(1, head), (30, ["006-01-003", "Toyota", "B", "5678-ABC", "On Job", "2020", "VIN-B"])],
        }
        for name, rows in sheets.items():
            root = ET.Element("worksheet", xmlns=ns)
            data = ET.SubElement(root, "sheetData")
            for number, values in rows:
                row = ET.SubElement(data, "row", r=str(number))
                for i, value in enumerate(values):
                    cell = ET.SubElement(row, "c", r=f"{chr(65+i)}{number}", t="inlineStr")
                    ET.SubElement(ET.SubElement(cell, "is"), "t").text = value
            z.writestr("xl/worksheets/" + name, ET.tostring(root))


with tempfile.TemporaryDirectory() as temp:
    book = pathlib.Path(temp) / "fixture.xlsx"
    fixture(book)
    data = audit.build_audit(book, [])
    by_door = {c["door_number"]: c for c in data["candidates"]}
    null = by_door["006-01-1000"]
    assert null["classification"] == "MISSING — READY TO IMPORT"
    assert null["plate_number"] is None and null["year"] is None
    assert null["status"] == "UNKNOWN" and null["is_active"] is None
    assert null["sources"][0]["source_row"] == 42
    assert by_door["006-01-002"]["make"] is None
    assert by_door["006-01-002"]["classification"] == "MISSING — CONFLICT / NEEDS REVIEW"
    assert by_door["006-01-004"]["classification"] == "DUPLICATE SOURCE DOOR NUMBER"
    assert by_door["006-01-003"]["classification"] == "MISSING — CONFLICT / NEEDS REVIEW"
    assert {c["field"] for c in by_door["006-01-003"]["conflicts"]} >= {"model", "plate_number"}
    assert audit.plate("006-01-1000") is None
    assert audit.plate("8178 U R B") == "8178-URB"
    assert audit.plate("ب ر و 8178") == "8178-URB"
    assert len(data["sheet_counts"]) == 3 and data["summary"]["unique_006"] == 4
    assert sum(r["classification"] == "DUPLICATE SOURCE DOOR NUMBER" for r in data["source_records"]) == 3
    # Existing UUIDs are only reported, never replaced or normalized into new rows.
    existing = audit.build_audit(book, [{"id": "stable-uuid", "door_number": "006-01-1000", "plate_number": None}])
    existing_row = next(c for c in existing["candidates"] if c["door_number"] == "006-01-1000")
    assert existing_row["classification"] == "ALREADY EXISTS"
    assert existing_row["production_id"] == "stable-uuid"
    print("fleet-audit: PASS (all-sheet relationships, exact XML rows, four-digit suffixes, nulls, conflicts, duplicates, no invented status/fields)")
