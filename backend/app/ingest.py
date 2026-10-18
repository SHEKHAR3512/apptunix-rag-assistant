"""Run from backend: python -m app.ingest --source ../knowledge/public."""

import argparse
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import ollama
from .config import settings
from .documents import ALLOWED, chunks, digest, extract, metadata, sections
from .store import activate, collection, db

progress = {
    "state": "idle",
    "completed": 0,
    "total": 0,
    "chunks": 0,
    "skipped": 0,
    "errors": [],
    "current": "",
}


def snapshot():
    return {**progress, "errors": list(progress["errors"])}


async def ingest(source: Path | None = None, reset: bool = False):
    root = (source or settings.knowledge_path).resolve()
    approved = settings.knowledge_path.resolve()
    if root != approved and approved not in root.parents:
        raise ValueError("Source must be within the approved knowledge directory.")
    # Exclusive lock also protects against a simultaneous CLI/API indexing job.
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    lock = settings.chroma_path / "ingest.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise ValueError(
            "Indexing already running. If a previous process crashed, remove data/chroma/ingest.lock after checking it is stopped."
        ) from exc
    os.close(fd)
    progress.update(
        state="running",
        completed=0,
        total=0,
        chunks=0,
        skipped=0,
        errors=[],
        current="Checking local embedding model",
    )
    try:
        identity = await ollama.embedding_identity()
        col = collection()
        old_identity = (col.metadata or {}).get("embedding_identity")
        if col.count() and old_identity != identity and not reset:
            raise ValueError(
                "Embedding model/version changed. Run a confirmed full rebuild before querying."
            )
        if reset and root != approved:
            raise ValueError("A reset must cover the entire knowledge folder.")
        files = sorted(
            p
            for p in root.rglob("*")
            if p.is_file() and p.suffix.lower() in ALLOWED and not p.is_symlink()
        )
        files = [p for p in files if approved in p.resolve().parents]
        progress["total"] = len(files)
        # Stage all changed documents before committing. A failed file retains its
        # prior chunks; a model-version rebuild commits only if every file succeeds.
        staged, seen, active_paths = [], set(), set()
        existing = col.get(include=["metadatas"])
        by_path = {}
        for cid, meta in zip(existing["ids"], existing["metadatas"]):
            by_path.setdefault(meta["path"], []).append((cid, meta))
        for path in files:
            rel = path.relative_to(approved).as_posix()
            active_paths.add(rel)
            progress["current"] = rel
            try:
                raw = extract(path)
                file_hash = digest(raw)
                if file_hash in seen:
                    staged.append((rel, [], [], [], []))
                    progress["skipped"] += 1
                    continue
                seen.add(file_hash)
                if (
                    not reset
                    and by_path.get(rel)
                    and all(m["file_hash"] == file_hash for _, m in by_path[rel])
                ):
                    progress["skipped"] += 1
                    continue
                meta, body = metadata(raw, path)
                texts, metas, ids = [], [], []
                for section_meta, section in sections(body, meta):
                    for chunk in chunks(section):
                        ids.append(digest(f"{rel}:{file_hash}:{len(ids)}"))
                        texts.append(chunk)
                        metas.append(
                            {
                                **section_meta,
                                "path": rel,
                                "file_hash": file_hash,
                                "embedding_identity": identity,
                            }
                        )
                if not texts:
                    raise ValueError("No source-bearing passages found.")
                vectors = []
                for i in range(0, len(texts), 8):
                    vectors.extend(await ollama.embed(texts[i : i + 8]))
                    progress["chunks"] += len(texts[i : i + 8])
                staged.append((rel, ids, texts, metas, vectors))
            except Exception as exc:
                progress["errors"].append({"file": rel, "error": str(exc)})
            finally:
                progress["completed"] += 1
        if reset and progress["errors"]:
            raise ValueError(
                "Full rebuild cancelled; fix failed documents. Previous index preserved."
            )
        if reset:
            # New collection permits a different embedding dimension. Readers keep
            # the old complete collection until the replacement is fully written.
            col = db().create_collection(
                "apptunix-" + uuid.uuid4().hex,
                embedding_function=None,
                metadata={"hnsw:space": "cosine"},
            )
        for rel, ids, texts, metas, vectors in staged:
            if ids:
                col.upsert(ids=ids, documents=texts, metadatas=metas, embeddings=vectors)
            stale = [cid for cid, _ in by_path.get(rel, []) if cid not in ids]
            if stale and not reset:
                col.delete(ids=stale)
        prefix = root.relative_to(approved).as_posix()
        deleted = [
            cid
            for rel, records in by_path.items()
            if rel not in active_paths and (prefix == "." or rel.startswith(prefix + "/"))
            for cid, _ in records
        ]
        if deleted and not reset:
            col.delete(ids=deleted)
        col.modify(
            metadata={
                "embedding_identity": identity,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if reset:
            activate(col.name)
        progress.update(
            state="partial" if progress["errors"] else "done",
            current="",
            indexed_chunks=col.count(),
        )
    except Exception as exc:
        progress["errors"].append({"file": "index", "error": str(exc)})
        progress.update(state="error", current="")
    finally:
        lock.unlink(missing_ok=True)
    return snapshot()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument(
        "--confirm-reset",
        action="store_true",
        help="Explicitly approve replacing the index (not source documents).",
    )
    args = parser.parse_args()
    if args.reset and not args.confirm_reset:
        parser.error("--reset requires --confirm-reset")
    result = asyncio.run(ingest(args.source, args.reset))
    print(json.dumps(result, indent=2))
    raise SystemExit(1 if result["errors"] else 0)
