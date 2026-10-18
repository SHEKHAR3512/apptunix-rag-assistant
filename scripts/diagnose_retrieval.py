import asyncio
import json
import sys
from pathlib import Path

# Ensure backend can be imported
sys.path.insert(0, str(Path("backend").resolve()))

from app import ollama
from app.config import settings
from app.store import collection


async def diagnose():
    col = collection()
    count = col.count()
    print(f"Chroma collection chunks count: {count}")
    
    questions = json.loads(Path("tests/evaluation.json").read_text(encoding="utf-8"))
    
    print("\n--- Retrieval Diagnostics (min_similarity = {}) ---".format(settings.min_similarity))
    print(f"{'#':2} | {'Kind':12} | {'Top Dist':8} | {'Top Sim':8} | {'# >= 0.45':9} | {'# >= 0.49':9} | Question")
    print("-" * 85)
    
    for i, item in enumerate(questions, 1):
        q = item["question"]
        search_text = q if "apptunix" in q.lower() else f"Apptunix: {q}"
        vector = (await ollama.embed([search_text], query=True))[0]
        res = col.query(query_embeddings=[vector], n_results=min(4, count), include=["distances", "documents", "metadatas"])
        
        distances = res["distances"][0] if res["distances"] else []
        sims = [1 - d for d in distances]
        top_sim = max(sims) if sims else 0
        top_dist = min(distances) if distances else 1
        cnt_normal = sum(1 for s in sims if s >= 0.45)
        cnt_strict = sum(1 for s in sims if s >= 0.49)
        
        print(f"{i:2d} | {item['kind']:12} | {top_dist:8.4f} | {top_sim:8.4f} | {cnt_normal:9d} | {cnt_strict:9d} | {q}")

if __name__ == "__main__":
    asyncio.run(diagnose())
