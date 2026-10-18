import math

import httpx

from .config import settings


def client(timeout: float = 180) -> httpx.AsyncClient:
    # Ignore system proxy settings: private local data never passes through a proxy.
    return httpx.AsyncClient(base_url=settings.ollama, timeout=timeout, trust_env=False)


async def models() -> list[dict]:
    async with client(4) as http:
        response = await http.get("/api/tags")
        response.raise_for_status()
        return [
            m
            for m in response.json()["models"]
            if "cloud" not in m["name"].lower() and not m.get("remote_host")
        ]


def find_model(items: list[dict], name: str) -> dict | None:
    return next((m for m in items if m["name"] == name or m["name"] == name + ":latest"), None)


async def embedding_identity() -> str:
    model = find_model(await models(), settings.embed_model)
    if model is None:
        raise ValueError(f"Embedding model missing. Run: ollama pull {settings.embed_model}")
    return f"{settings.embed_model}@{model['digest']}"


async def embed(texts: list[str], *, query: bool = False) -> list[list[float]]:
    # EmbeddingGemma's recommended retrieval task prefixes, identical across runs.
    inputs = [
        f"task: search result | query: {t}" if query else f"title: Apptunix | text: {t}"
        for t in texts
    ]
    async with client() as http:
        response = await http.post(
            "/api/embed",
            json={
                "model": settings.embed_model,
                "input": inputs,
                "truncate": False,
                "keep_alive": "5m",
            },
        )
        response.raise_for_status()
        vectors = response.json().get("embeddings", [])
    if len(vectors) != len(texts) or not vectors:
        raise ValueError("Ollama returned an incomplete embedding batch.")
    dimension = len(vectors[0])
    if not dimension or any(
        len(v) != dimension or not all(math.isfinite(x) for x in v) or not any(v) for v in vectors
    ):
        raise ValueError("Ollama returned invalid embedding vectors.")
    return vectors
