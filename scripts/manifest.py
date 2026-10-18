"""Rebuild the source manifest from reviewed Markdown metadata; no networking."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
records = []
for path in sorted((ROOT / "knowledge/public").glob("*.md")):
    text = path.read_text(encoding="utf-8-sig")
    if text.startswith("---"):
        header = text.split("---", 2)[1]
        record = dict(line.split(":", 1) for line in header.strip().splitlines() if ":" in line)
        records.append(
            {
                "file": path.relative_to(ROOT).as_posix(),
                **{k: v.strip() for k, v in record.items()},
                "source_type": "official_website",
                "collection_method": "manually reviewed concise paraphrase",
            }
        )
    else:
        records.append(
            {
                "file": path.relative_to(ROOT).as_posix(),
                "title": "Supplied public starter",
                "source_urls": list(
                    dict.fromkeys(re.findall(r"https://www\.apptunix\.com/[^\s)]*", text))
                ),
                "last_checked": "2026-10-18",
                "review_status": "user_supplied_reviewed",
                "source_type": "supplied_document",
                "visibility": "public",
            }
        )
(ROOT / "knowledge/manifest.json").write_text(
    json.dumps(records, indent=2) + "\n", encoding="utf-8"
)
print(f"Recorded {len(records)} source documents.")
