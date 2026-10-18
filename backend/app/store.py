import json
import os
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from .config import settings

COLLECTION = "apptunix-knowledge"


@lru_cache
def db():
    return chromadb.PersistentClient(
        path=str(settings.chroma_path), settings=ChromaSettings(anonymized_telemetry=False)
    )


def collection():
    pointer = settings.chroma_path / "active.json"
    name = json.loads(pointer.read_text())["collection"] if pointer.exists() else COLLECTION
    return db().get_or_create_collection(
        name, embedding_function=None, metadata={"hnsw:space": "cosine"}
    )


def activate(name: str):
    pointer = settings.chroma_path / "active.json"
    temporary = pointer.with_suffix(".tmp")
    temporary.write_text(json.dumps({"collection": name}))
    os.replace(temporary, pointer)


def inventory() -> list[dict]:
    records = collection().get(include=["metadatas"])
    sources = {}
    for meta in records["metadatas"]:
        key = meta["path"]
        if key not in sources:
            sources[key] = {**meta, "chunks": 0}
        sources[key]["chunks"] += 1
    return sorted(sources.values(), key=lambda d: d["title"])
