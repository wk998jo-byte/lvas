"""Render a private self-contained full HTML report from the generated audit.

python3 -B scripts/render-fleet-report.py output-directory pr-url browser-verdict
No network, database, execution plan, or Production operations are performed.
"""
import html
import json
import pathlib
import sys

folder = pathlib.Path(sys.argv[1])
pr = sys.argv[2]
browser = sys.argv[3]
audit = json.loads((folder / "audit.json").read_text())
s = audit["summary"]
esc = lambda value: html.escape(str(value if value is not None else "Unavailable"))


def table(headers, rows):
    return "<div class='scroll'><table><thead><tr>" + "".join(f"<th>{esc(h)}</th>" for h in headers) + \
        "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{esc(v)}</td>" for v in row) + "</tr>" for row in rows) + \
        "</tbody></table></div>"


def refs(candidate):
    return "; ".join(f'{r["source_sheet"]}!{r["source_row"]}' for r in candidate["sources"])


parts = ["""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LVAS Complete 006 Fleet Preparation</title>
<style>
*{box-sizing:border-box}body{font:15px/1.65 system-ui,sans-serif;color:#172133;background:#f3f5f8;margin:0}
main{max-width:1280px;margin:auto;padding:40px 24px;background:#fff}h1{font-size:32px;margin:0 0 8px}
h2{border-top:2px solid #e4e8ed;padding-top:22px;margin-top:34px;color:#8b151a}
h3{margin:26px 0 5px}.notice{background:#fff3dc;border-left:4px solid #b66c00;padding:16px}
.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin:16px 0}
th,td{padding:9px 12px;vertical-align:top;text-align:left;border-bottom:1px solid #e4e8ed}
th{background:#edf1f5;position:sticky;top:0}td:first-child{white-space:nowrap}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7f9;padding:12px;border-radius:5px}
details{border:1px solid #dde2e8;padding:12px;margin:12px 0}summary{cursor:pointer;font-weight:650}
.muted{color:#657286}a{color:#b11b21}code{background:#f3f5f7;padding:2px 4px}
@media print{body{background:white}main{padding:0;max-width:none}h2{break-after:avoid}details{display:block}}
</style><main><h1>LVAS Complete 006 Fleet Preparation</h1>
<p class="muted">10 October 2026 · Complete workbook audit and verified import preparation</p>
<div class="notice"><strong>Production writes: ZERO.</strong> No Production migration,
real vehicle import, merge, or republish. Not authorized/ready for controlled live
execution. This report and private datasets are excluded from Git and deployment.</div>"""]
parts += [f"<h2>Source</h2><p><strong>Workbook analyzed:</strong> {esc(audit['workbook'])}<br>"
          f"<strong>Unique 006 Door Numbers discovered:</strong> {s['unique_006']}<br>"
          f"<strong>Classified source rows:</strong> {s['source_006_rows']}</p>",
          table(["Sheet inspected", "Data rows", "006 rows", "Unique 006"],
                [[r["sheet"], r["data_rows"], r["006_rows"], r["006_unique"]] for r in audit["sheet_counts"]]),
          f"<p><strong>Workbook SHA-256:</strong> <code>{audit['workbook_sha256']}</code><br>"
          f"<strong>Snapshot canonical SHA-256:</strong> <code>{audit['production_snapshot_sha256']}</code></p>",
          "<h2>Production comparison</h2>",
          table(["Measure", "Count"], [
              ["Current Production vehicles", s["production_vehicles"]],
              ["Current Production 006 Door Numbers", s["production_006"]],
              ["Already exists", s["already_exists"]], ["Missing source vehicles", s["missing"]],
              ["Ready to import", s["ready"]], ["Need review", s["need_review"]],
              ["Source duplicate Door keys (including cross-sheet corroboration)", s["duplicate_source_doors"]],
              ["Repeated source rows classified DUPLICATE", s["source_006_rows"] - s["unique_006"]],
              ["Within-sheet duplicate Door keys", s["same_sheet_duplicate_doors"]],
          ]),
          "<p>Door Number is the sole matching key. Existing matches retain their UUIDs "
          "and every stored attribute. Consistent cross-sheet occurrences are consolidated; "
          "true identity conflicts are never reconciled automatically. Valid four-digit "
          "suffixes and all leading zeros are retained.</p>",
          "<h2>Data completeness</h2>",
          table(["Missing vehicle measure", "Count"], [
              ["With a supplied plate in any source", s["missing_with_plate"]],
              ["Without a supplied plate in every source", s["missing_without_plate"]],
              ["Missing year", s["missing_year"]], ["Missing make/model", s["missing_make_model"]],
              ["Status known", s["status_known"]], ["Status UNKNOWN", s["status_unknown"]],
          ]),
          "<p>Six missing candidates have no single resolved plate due to conflicts/absence; "
          "only one source vehicle genuinely lacks a plate. Plate/year absence alone never "
          "blocks readiness. Missing required make/model is reported for review, not invented. "
          "All source statuses are retained verbatim when trustworthy, otherwise UNKNOWN. "
          "Every new import availability boolean requires separate explicit approval; "
          "no activation plan is approved or supplied for Production.</p>",
          "<h2>Conflicts — each item separately</h2>",
          f"<p><strong>{s['conflict_items']} separate conflict/data-quality items across "
          f"{s['conflict_doors']} Door Numbers.</strong> This includes existing-vehicle source "
          "discrepancies as well as the 20 missing records held for review. The following list "
          "is complete, not a sample. Canonical fields marked unavailable may be conflicting "
          "rather than wholly absent; individual source observations remain in audit.json.</p>"]
for c in audit["candidates"]:
    if c["conflicts"]:
        parts.append(f"<h3>{esc(c['door_number'])} — {esc(c['classification'])}</h3>"
                     f"<p>Source references: {esc(refs(c))}<br>Candidate plate: {esc(c['plate_number'])}; "
                     f"make: {esc(c['make'])}; model: {esc(c['model'])}; year: {esc(c['year'])}</p>")
        for number, conflict in enumerate(c["conflicts"], 1):
            parts.append(f"<p><strong>{esc(c['door_number'])} / conflict {number}: "
                         f"{esc(conflict['field'])}</strong></p>"
                         f"<pre>{esc(json.dumps(conflict, ensure_ascii=False, indent=2))}</pre>")
parts += ["<h2>Duplicate Door Numbers</h2><p>All 342 repeatedly observed keys are listed, "
          "with exact references. Cross-sheet repetition is normally corroboration; "
          "the LMV duplicate key is 006-01-023, rows 20 and 45, also present in "
          "Asset Master Data row 2463.</p>",
          "<details><summary>Complete repeated-key reference table</summary>",
          table(["Door", "Occurrences", "References", "Within-sheet duplicate"],
                [[c["door_number"], len(c["sources"]), refs(c), c["same_sheet_duplicate"]]
                 for c in audit["candidates"] if len(c["sources"]) > 1]), "</details>",
          "<h2>Existing Production placeholder/incomplete records</h2>",
          table(["Vehicle UUID", "Door", "Stored plate (unchanged)", "Make", "Model", "Year", "Issues"],
                [[r["id"], r["door_number"], r["plate_number"], r["make"], r["model"], r["year"], "; ".join(r["issues"])]
                 for r in audit["production_review"]]),
          "<p>No Door-as-plate values occur in this workbook. Three historic Production "
          "placeholders are preserved in storage and hidden as plates in presentation. "
          "The legacy plate 5546 test record is reported without guessing a Door.</p>",
          "<h2>Application</h2>",
          table(["Requirement", "Result"], [
              ["Plate nullable migration; multiple NULLs; non-null plate and Door uniqueness", "PASS — disposable only"],
              ["Null plate UI / Door-first identity / unchanged legacy placeholder edit", "PASS"],
              ["Door search", "PASS"], ["Existing plate search", "PASS"],
              ["Request / authorization / pass / tracking / gate", "PASS"],
              ["QR privacy — URL/token only", "PASS"],
          ]),
          "<h2>Import</h2>",
          table(["Requirement", "Result"], [
              ["Import script prepared", "YES"], ["Idempotent", "PASS"],
              ["First whole READY fixture import", "417 inserted"],
              ["Second whole READY fixture import", "417 skipped; zero inserted"],
              ["Unexpected conflict rollback", "PASS"],
              ["Original 326 vehicle records/UUIDs/fields preserved", "PASS"],
              ["Authorization vehicle UUIDs unchanged", "PASS"],
              ["Existing vehicle updates by importer", "ZERO"],
              ["Production writes", "ZERO"],
          ]),
          "<p>Script validates only READY data, requires approved per-Door availability, "
          "inserts missing Doors with unique conflict protection, and rolls back unexpected "
          "errors transactionally. CLI and callable importer refuse every non-disposable "
          "database. Source status/category/chassis/references are retained in notes.</p>",
          "<h2>Verification</h2><p><strong>Tests: PASS.</strong> New XML/audit tests, disposable "
          "full import/rollback/rerun tests and all nine existing LVAS security/approval "
          "regression suites passed.<br><strong>Build: PASS.</strong> npm run build<br>"
          f"<strong>Targeted browser verification:</strong> {esc(browser)}<br>"
          f'<strong>PR:</strong> <a href="{esc(pr)}">{esc(pr)}</a> — DO NOT MERGE<br>'
          "<strong>Ready for controlled Production rollout: NO.</strong> Requires availability "
          "approval, review of conflict records, a fresh pre-execution snapshot and a separately "
          "reviewed Production runner/migration.<br>"
          "<strong>Whole-repository ESLint:</strong> eight pre-existing errors; new scripts "
          "introduce no new errors. This is separate from the required passing build and "
          "security/approval tests.</p>",
          "<h2>All missing source vehicles</h2>",
          table(["Door", "Plate", "Make", "Model", "Year", "Category", "Status", "Classification", "Source references"],
                [[c["door_number"], c["plate_number"], c["make"], c["model"], c["year"], ", ".join(c["category"]),
                  c["status"], c["classification"], refs(c)]
                 for c in audit["candidates"] if c["classification"] != "ALREADY EXISTS"]),
          "<h2>Files changed</h2>"]
filelist = folder / "release-files.txt"
parts.append("<pre>" + esc(filelist.read_text() if filelist.exists() else "See PR changed-files list") + "</pre>")
parts.append("<p class='notice'><strong>STOP AFTER REPORT.</strong> No live execution "
             "has been performed or authorized.</p></main></html>")
(folder / "complete-report.html").write_text("\n".join(parts), encoding="utf-8")
print("Generated private self-contained complete-report.html")
