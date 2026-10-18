"""Live retrieval scores for threshold calibration; run from the repository root."""

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.rag import retrieve  # noqa: E402


async def main():
    questions = json.loads((ROOT / "tests/evaluation.json").read_text())
    questions += [{"question": "What is Apptunix's cafeteria lunch menu?", "kind": "unknown"}]
    results = []
    for item in questions:
        sources = await retrieve(item["question"], 4, False)
        record = {
            "question": item["question"],
            "kind": item["kind"],
            "results": [
                {"title": s["title"], "similarity": s["similarity"], "passage": s["passage"]}
                for s in sources
            ],
        }
        results.append(record)
        print(item["question"], [(s["title"], s["similarity"]) for s in sources], flush=True)
    (ROOT / "docs/retrieval-results.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )


asyncio.run(main())
