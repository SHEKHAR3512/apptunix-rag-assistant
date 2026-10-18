import asyncio
import json
from dataclasses import replace

import httpx
from app import main, ollama, rag
from app.config import Settings, settings
from fastapi.testclient import TestClient


def test_validation_origin_and_local_only():
    with TestClient(main.app) as client:
        assert client.post("/api/chat", json={"question": "   "}).status_code == 422
        assert client.post("/api/chat", json={"question": "a" * 2001}).status_code == 422
        assert (
            client.post(
                "/api/chat", json={"question": "Apptunix?", "model": "model:cloud"}
            ).status_code
            == 400
        )
        assert client.post("/api/index", json={"reset": True}).status_code == 400
        assert (
            client.post(
                "/api/index", json={}, headers={"Origin": "https://evil.example"}
            ).status_code
            == 403
        )
        assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400
    with TestClient(main.app, client=("192.168.1.1", 123)) as remote:
        assert remote.get("/api/health").status_code == 403


def test_scope_and_unavailable_information():
    with TestClient(main.app) as client:
        for question, phrase in [
            ("What is Apptunix's exact internal payroll?", "couldn't find"),
            ("Write a recipe for pancakes", "Please ask a question about Apptunix"),
        ]:
            response = client.post("/api/chat", json={"question": question})
            events = [json.loads(line) for line in response.text.splitlines()]
            assert phrase in "".join(e.get("text", "") for e in events)
            assert events[-1]["type"] == "done"
            assert events[-2]["sources"] == []


def test_uploads_validate_and_deduplicate(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, knowledge_path=tmp_path))
    with TestClient(main.app) as client:
        assert (
            client.post("/api/documents", files={"file": ("file.exe", b"bad")}).status_code == 400
        )
        assert client.post("/api/documents", files={"file": ("empty.txt", b"")}).status_code == 400
        response = client.post(
            "/api/documents", files={"file": ("../../test.txt", b"Public approved document")}
        )
        assert response.status_code == 201
        assert len(list((tmp_path / "imported").iterdir())) == 1
        assert client.post(
            "/api/documents", files={"file": ("../../test.txt", b"Public approved document")}
        ).json()["duplicate"]


def test_unreachable_ollama_is_clear(monkeypatch):
    async def unavailable(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(rag, "retrieve", unavailable)
    with TestClient(main.app) as client:
        result = client.post("/api/chat", json={"question": "What services does Apptunix offer?"})
        events = [json.loads(line) for line in result.text.splitlines()]
        assert events[-1]["type"] == "error"
        assert "disconnected" in events[-1]["message"]


def test_true_unreachable_ollama_endpoint(monkeypatch):
    unreachable = replace(settings, ollama="http://127.0.0.1:59999")
    monkeypatch.setattr(ollama, "settings", unreachable)
    with TestClient(main.app) as client:
        result = client.post("/api/chat", json={"question": "What services does Apptunix offer?"})
        events = [json.loads(line) for line in result.text.splitlines()]
        assert events[-1]["type"] == "error"
        assert "disconnected" in events[-1]["message"]


def test_actual_used_sources_only():
    sources = [{"id": "S1"}, {"id": "S2"}, {"id": "S3"}]
    assert rag.used_sources("Mobile apps [S2]. Also [S2].", sources) == [{"id": "S2"}]


def test_ollama_cloud_url_rejected():
    import pytest

    with pytest.raises(ValueError, match="loopback"):
        Settings(ollama="https://ollama.com")


def test_invalid_embeddings_are_rejected(monkeypatch):
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json={"embeddings": [[0.0, 0.0]]})
    )
    monkeypatch.setattr(
        ollama,
        "client",
        lambda *args: httpx.AsyncClient(transport=transport, base_url="http://localhost"),
    )
    import pytest

    with pytest.raises(ValueError, match="invalid"):
        asyncio.run(ollama.embed(["test"]))
