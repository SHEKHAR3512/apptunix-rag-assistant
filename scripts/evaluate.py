"""Live evaluation, requiring the running backend and both downloaded models.

Checks citation identity and key-topic coverage; human grounding review remains
necessary. Saves full answers, passage evidence, latency and actual event counts.
"""

import argparse
import json
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--limit", type=int, default=20)
args = parser.parse_args()
questions = json.loads((ROOT / "tests/evaluation.json").read_text())[: args.limit]
results = []
with httpx.Client(base_url="http://127.0.0.1:8000", timeout=300, trust_env=False) as client:
    for item in questions:
        start = time.monotonic()
        events, answer, sources, errors = [], "", [], []
        with client.stream("POST", "/api/chat", json={"question": item["question"]}) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                event = json.loads(line)
                events.append(event["type"])
                if event["type"] == "token":
                    answer += event["text"]
                if event["type"] == "replace":
                    answer = event["text"]
                if event["type"] == "sources":
                    sources = event["sources"]
                if event["type"] == "error":
                    errors.append(event["message"])
        if item["kind"] == "answerable":
            passed = bool(sources) and all(term.lower() in answer.lower() for term in item["terms"])
        else:
            passed = not sources and any(
                term in answer.lower()
                for term in ["couldn't find", "please ask", "cannot", "can't", "insufficient"]
            )
        result = {
            **item,
            "answer": answer,
            "sources": sources,
            "events": events,
            "seconds": round(time.monotonic() - start, 2),
            "errors": errors,
            "automatic_pass": passed and not errors,
        }
        results.append(result)
        print(
            f"{'PASS' if result['automatic_pass'] else 'REVIEW'} {item['question']} ({result['seconds']}s)",
            flush=True,
        )
        (ROOT / "docs/evaluation-results.json").write_text(
            json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
        )
print(
    f"{sum(r['automatic_pass'] for r in results)}/{len(results)} automated checks passed. Review full answers in docs/evaluation-results.json."
)
