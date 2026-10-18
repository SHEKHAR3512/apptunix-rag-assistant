import json
from pathlib import Path

path = Path("docs/evaluation-results.json")
if not path.exists():
    print("No evaluation results found.")
    exit(1)

results = json.loads(path.read_text(encoding="utf-8"))
print(f"Total evaluated: {len(results)}")
passed = sum(1 for r in results if r.get("automatic_pass"))
print(f"Passed: {passed}/{len(results)}")

for i, r in enumerate(results, 1):
    status = "PASS" if r.get("automatic_pass") else "FAIL"
    sec = r.get("seconds", 0)
    sources = len(r.get("sources", []))
    q = r.get("question", "")
    print(f"{i:2d}. [{status}] ({sec:5.1f}s, {sources} sources) {q}")
    if not r.get("automatic_pass"):
        print(f"    Kind: {r.get('kind')}, Terms: {r.get('terms')}")
        print(f"    Answer: {r.get('answer', '')[:160]}")
        print(f"    Errors: {r.get('errors')}")
