import asyncio
import hashlib
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import ingest, ollama
from .config import ROOT, settings
from .documents import ALLOWED, MAX_BYTES, extract
from .rag import answer
from .store import collection, inventory

index_task: asyncio.Task | None = None
chat_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app):
    yield
    if index_task and not index_task.done():
        index_task.cancel()
        try:
            await index_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Apptunix Knowledge Desk", lifespan=lifespan)
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]", "testserver"]
)
origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(origins),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def local_only(request: Request, call_next):
    if request.url.path.startswith("/api"):
        if request.client and request.client.host not in {"127.0.0.1", "::1", "testclient"}:
            return JSONResponse(
                {"detail": "This API is available on localhost only."}, status_code=403
            )
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse({"detail": "Untrusted browser origin."}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


class HistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=6000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=12)
    top_k: int = Field(default=settings.top_k, ge=1, le=8)
    strict: bool = True
    model: str | None = Field(default=None, max_length=100, pattern=r"^[a-zA-Z0-9_.:/-]+$")


class IndexRequest(BaseModel):
    reset: bool = False
    confirm_reset: bool = False


@app.get("/api/health")
async def health():
    result = {
        "backend": "ready",
        "ollama": "disconnected",
        "chat_model": settings.chat_model,
        "chat_ready": False,
        "embedding_model": settings.embed_model,
        "models": [],
        "index_ready": False,
        "chunks": 0,
        "documents": 0,
        "error": None,
    }
    try:
        available = await ollama.models()
        result.update(ollama="connected", models=[m["name"] for m in available])
        result["chat_ready"] = bool(ollama.find_model(available, settings.chat_model))
        if not result["chat_ready"]:
            result["error"] = f"Download the chat model: ollama pull {settings.chat_model}"
    except Exception:
        result["error"] = "Ollama is unavailable. Start Ollama and check the local model downloads."
        available = []
    try:
        col = collection()
        result.update(chunks=col.count(), documents=len(inventory()))
        embedding = ollama.find_model(available, settings.embed_model)
        identity = f"{settings.embed_model}@{embedding['digest']}" if embedding else None
        result["index_ready"] = bool(
            col.count() and identity and (col.metadata or {}).get("embedding_identity") == identity
        )
        if not embedding and result["ollama"] == "connected":
            result["error"] = f"Download {settings.embed_model} to build the index."
        elif col.count() and not result["index_ready"]:
            result["error"] = "Embedding version changed. Rebuild the index."
    except Exception as exc:
        result["error"] = (
            f"The local knowledge database could not start: {exc}. Check the Chroma/Visual C++ installation."
        )
    return result


@app.get("/api/sources")
async def sources():
    return {"sources": await asyncio.to_thread(inventory)}


@app.post("/api/chat")
async def chat(payload: ChatRequest, request: Request):
    if not payload.question.strip():
        raise HTTPException(422, "Enter a question.")
    if payload.model and "cloud" in payload.model.lower():
        raise HTTPException(400, "Cloud models are disabled.")
    if (
        chat_lock.locked()
        or (index_task and not index_task.done())
        or (settings.chroma_path / "ingest.lock").exists()
    ):
        raise HTTPException(409, "A local model task is already running. Wait for it to finish.")

    async def stream():
        async with chat_lock:
            async for item in answer(payload, request):
                yield item

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/api/index", status_code=202)
async def build_index(payload: IndexRequest):
    global index_task
    if chat_lock.locked() or (index_task and not index_task.done()):
        raise HTTPException(409, "Another local model task is running.")
    if payload.reset and not payload.confirm_reset:
        raise HTTPException(400, "A full rebuild requires explicit confirmation.")
    index_task = asyncio.create_task(ingest.ingest(reset=payload.reset))
    # Report running immediately, before the first polling request.
    ingest.progress.update(
        state="running", completed=0, total=0, chunks=0, skipped=0, errors=[], current="Preparing"
    )
    return {"state": "running"}


@app.get("/api/index/status")
async def index_status():
    return ingest.snapshot()


@app.post("/api/documents", status_code=201)
async def upload(file: UploadFile = File(...)):
    if index_task and not index_task.done():
        raise HTTPException(409, "Wait for indexing to finish before adding documents.")
    filename = (file.filename or "").replace("\\", "/").split("/")[-1]
    from pathlib import Path

    if Path(filename).suffix.lower() not in ALLOWED:
        raise HTTPException(400, "Choose a Markdown, TXT or searchable PDF file.")
    data = await file.read(MAX_BYTES + 1)
    await file.close()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Document exceeds 10 MB.")
    name = re.sub(r"[^\w. -]", "_", filename)[:100]
    folder = settings.knowledge_path / "imported"
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / (hashlib.sha256(data).hexdigest()[:12] + "-" + name)
    if destination.exists():
        return {
            "name": destination.name,
            "duplicate": True,
            "message": "This document is already present.",
        }
    destination.write_bytes(data)
    try:
        await asyncio.to_thread(extract, destination)
    except Exception as exc:
        destination.unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc
    return {
        "name": destination.name,
        "duplicate": False,
        "message": "Document added. Update the index to make it searchable.",
    }


# A built frontend is served locally by FastAPI, so production needs one server.
if (ROOT / "frontend/dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "frontend/dist", html=True), name="frontend")
