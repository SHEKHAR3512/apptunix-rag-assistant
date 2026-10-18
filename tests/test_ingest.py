import asyncio
from dataclasses import replace

import chromadb
import pytest
from app import ingest, ollama, store
from app.config import settings


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    config = replace(settings, chroma_path=tmp_path / "db", knowledge_path=tmp_path / "knowledge")
    config.knowledge_path.mkdir()
    monkeypatch.setattr(ingest, "settings", config)
    monkeypatch.setattr(store, "settings", config)
    client = chromadb.PersistentClient(path=str(config.chroma_path))
    monkeypatch.setattr(store, "db", lambda: client)
    monkeypatch.setattr(ingest, "db", lambda: client)
    calls = []

    async def embed(texts):
        calls.extend(texts)
        return [[float(len(t)), 1.0, 2.0] for t in texts]

    async def identity():
        return "test-model@digest1"

    monkeypatch.setattr(ollama, "embed", embed)
    monkeypatch.setattr(ollama, "embedding_identity", identity)
    return config, calls


def test_incremental_duplicate_update_delete_and_persistence(isolated):
    config, calls = isolated
    original = config.knowledge_path / "a.md"
    original.write_text("# Apps\n\nApptunix develops native Android apps.")
    duplicate = config.knowledge_path / "b.txt"
    duplicate.write_text(original.read_text())
    result = asyncio.run(ingest.ingest())
    assert result["state"] == "done", result["errors"]
    assert store.collection().count() == 1
    assert len(calls) == 1
    asyncio.run(ingest.ingest())
    assert len(calls) == 1, "Unchanged corpus must not be embedded again"
    original.write_text("# Apps\n\nApptunix develops iOS applications with Swift.")
    duplicate.unlink()
    asyncio.run(ingest.ingest())
    docs = store.collection().get()["documents"]
    assert len(docs) == 1 and "Swift" in docs[0] and "Android" not in docs[0]
    reopened = chromadb.PersistentClient(path=str(config.chroma_path)).get_collection(
        store.collection().name
    )
    assert reopened.count() == 1
    original.unlink()
    asyncio.run(ingest.ingest())
    assert store.collection().count() == 0


def test_failed_change_keeps_old_chunks(isolated, monkeypatch):
    config, _ = isolated
    path = config.knowledge_path / "a.md"
    path.write_text("# Original\n\nVerified content.")
    asyncio.run(ingest.ingest())
    path.write_text("# Changed\n\nMore content.")

    async def fail(texts):
        raise ValueError("Embedding failed")

    monkeypatch.setattr(ollama, "embed", fail)
    result = asyncio.run(ingest.ingest())
    assert result["state"] == "partial", result["errors"]
    assert "Original" in store.collection().get()["documents"][0]


def test_embedding_version_rebuild_and_dimension_change(isolated, monkeypatch):
    config, _ = isolated
    (config.knowledge_path / "a.md").write_text("# Apps\n\nVerified facts.")
    asyncio.run(ingest.ingest())

    async def new_identity():
        return "new-model@digest2"

    async def new_embed(texts):
        return [[1.0, 2.0, 3.0, 4.0] for _ in texts]

    monkeypatch.setattr(ollama, "embedding_identity", new_identity)
    monkeypatch.setattr(ollama, "embed", new_embed)
    assert asyncio.run(ingest.ingest())["state"] == "error"
    assert asyncio.run(ingest.ingest(reset=True))["state"] == "done"
    assert store.collection().metadata["embedding_identity"] == "new-model@digest2"
    assert len(store.collection().get(include=["embeddings"])["embeddings"][0]) == 4


def test_source_path_is_restricted(isolated):
    config, _ = isolated
    with pytest.raises(ValueError, match="approved"):
        asyncio.run(ingest.ingest(config.knowledge_path.parent))
