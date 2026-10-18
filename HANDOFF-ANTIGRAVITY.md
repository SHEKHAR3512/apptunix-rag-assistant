# Resume this project — Antigravity handoff

Updated: 2026-10-18. This is a live handoff; read it together with README.md (when
present), docs/ORIGINAL-REQUIREMENTS.md, DESIGN.md and docs/DESIGN-AUDIT.md.

## Paste this into Antigravity

```text
Continue the existing Apptunix offline RAG chatbot at:
C:\Users\shekh\OneDrive\Desktop\apptunix-rag-assistant

Read HANDOFF-ANTIGRAVITY.md completely, then docs/ORIGINAL-REQUIREMENTS.md,
DESIGN.md, DWI-BRIEF.md and docs/DESIGN-AUDIT.md. Inspect current files and running
services before changing anything. Do not restart or replace the project.

Finish the outstanding implementation and verification. Use only the installed
design-with-intent skill for design work. Its Create, Audit and Repair workflows
have already been invoked; preserve the established design and repair defects.
Keep all runtime processing local. Required models: gemma3:4b and embeddinggemma.
Ollama model storage MUST stay at D:\Ollama\models. No paid APIs or cloud DBs.

Complete real model/index tests, 20-question evaluation, browser flow tests,
stream cancellation, offline tests, README/start commands and testing report.
Fix failures and report what actually passed. Preserve existing source documents,
code, downloaded models, dependencies and user data. Update this handoff if needed.
```

## Environment and exact locations

- Project: `C:\Users\shekh\OneDrive\Desktop\apptunix-rag-assistant`
- Real Desktop is redirected to OneDrive; `C:\Users\shekh\Desktop` does not exist.
- Node 24.22.0, npm 11.19.1. Use `npm.cmd` / `npx.cmd` in PowerShell.
- Python installed at `C:\Users\shekh\AppData\Local\Programs\Python\Python312\python.exe`.
- Backend venv: `backend\.venv\Scripts\python.exe` (Python 3.12.10).
- Ollama installed at `C:\Users\shekh\AppData\Local\Programs\Ollama\ollama.exe` (0.40.5).
- Models: `D:\Ollama\models`; user environment OLLAMA_MODELS is set there.
- User OLLAMA_NO_CLOUD=1; running server log confirms cloud disabled and D: model path.
- Machine: approximately 16 GB RAM, NVIDIA GTX 1650 with 4 GB VRAM.
- Ollama log: `D:\Ollama\server.err.log` and `server.out.log`.
- Backend http://127.0.0.1:8000 ; Vite http://127.0.0.1:5173 . Check before starting duplicates.
- Chromium/Playwright installed; tests currently use installed Microsoft Edge
  (`channel: 'msedge'`) for reproducible screenshots.

## Implemented

- React/TypeScript/Vite custom CSS UI; welcome, animated assistant, semantic
  processing states, composer, NDJSON streaming, Stop via AbortController,
  local conversation history, copy, expandable source dialogs, light/dark theme,
  mobile navigation, knowledge library, approved uploads, indexing status,
  full-rebuild confirmation, local model and retrieval settings.
- FastAPI API for health, chat, sources, documents, index, index/status; loopback
  host/client/origin restrictions; built frontend served by FastAPI when dist exists.
- Markdown/TXT/PDF extraction with size limits and scan-only PDF errors, paragraph
  chunking (~500 token estimate / ~80 token overlap), source-section preservation
  for the provided starter, duplicate detection and incremental changed/deleted files.
- Real Ollama /api/embed calls with retrieval prefixes, embedding digest checks,
  Chroma cosine vectors on disk; full rebuild uses new collection + atomic pointer
  to support different vector dimensions and preserve the previous index on failure.
- /api/chat streams statuses, tokens, cited sources, done/error; only actual cited
  source IDs retained, invalid/no citation completion replaced by abstention.
  Confidential/payroll/etc. deterministic abstentions and basic out-of-scope guard.
- Ten public documents: original starter + nine concise reviewed official-source
  summaries including Android, iOS, services, industries, contact, healthcare,
  ISUZU and Amber. `knowledge/manifest.json` records source URLs and review dates.
- Design-with-intent installed in `.agents/skills/design-with-intent/`; actual
  Create/Audit/Repair CLI prompts and relevant skill references were read.
- Design captures in `docs/design-before-edge` and `docs/design-after`.
- Backend tests, frontend stream tests, browser-flow script and 20-question live
  evaluation harness are present. `scripts/start.ps1` and manifest generator exist.

## Verified results

- Backend: **18 passed**, `backend\.venv\Scripts\python.exe -m pytest -q`.
  Includes real Chroma vector database queries and true unreachable local endpoint recovery test.
- Code style: **Ruff clean**, `backend\.venv\Scripts\python.exe -m ruff check backend\app tests scripts` (0 errors).
- Frontend: **5 Vitest tests passed**, TypeScript strict typecheck passed, ESLint passed (0 errors), production build passed in 2.36s.
- `npm audit` reports **0 vulnerabilities**.
- Ollama models: both `gemma3:4b` (3.4 GB) and `embeddinggemma:latest` (621 MB) downloaded at `D:\Ollama\models` with cloud disabled (`OLLAMA_NO_CLOUD=1`).
- Real Chroma ingestion: 14 searchable chunks from 10 public company source documents indexed in `data/chroma`.
- Retrieval calibration: `scripts/diagnose_retrieval.py` confirms answerable company questions score 0.5918 to 0.7628 similarity, while out-of-scope prompts score 0.3359 to 0.4076. Floor of 0.45 (0.49 strict) cleanly separates relevance.
- 20-Question Evaluation: **20/20 passed**, `backend\.venv\Scripts\python.exe scripts\evaluate.py`.
  - 12/12 answerable queries verified with grounded passages and valid citations.
  - 8/8 confidential, ambiguous, and out-of-scope queries verified with honest abstentions/scope guidance and 0 hallucinated sources.
  - Full answer transcripts and evidence saved in `docs/evaluation-results.json` and summarized in `TESTING.md`.
- Browser suite: **10/10 passed** with `--live` flag using Microsoft Edge (`node tests/browser.mjs --live`).
  - Tested reflow at 320px, 360px, 768px, 1280px (no overflow).
  - Keyboard navigation, theme persistence, focus restoration, explicit document approval checkbox.
  - Real streaming completion, citation modal inspection, Stop generation abort, zero browser errors, and strictly 0 external network requests.
  - Verified on both dev server (port 5173) and single-port FastAPI production serving (port 8000).
- Documentation: `TESTING.md` created with comprehensive grounding audits; `DESIGN.md` updated with verification records; `README.md` verified with working commands.
- Dependencies: `backend/requirements.lock.txt` refreshed with frozen environment.

## Status: All milestones completed and verified

1. [x] Model downloads (`gemma3:4b` and `embeddinggemma`) and real Chroma ingestion completed.
2. [x] Real retrieval calibration analyzed via `scripts/diagnose_retrieval.py` and `scripts/retrieval_check.py`.
3. [x] 20-question evaluation harness passed (20/20) and audited in `TESTING.md`.
4. [x] Browser automation suite with live streaming, citation modal, and abort passed (10/10).
5. [x] Offline runtime confirmed with zero external requests intercepted.
6. [x] True unreachable local endpoint error recovery test implemented and passing in pytest.
7. [x] Screenshots captured across viewports and themes in `docs/browser/`.
8. [x] `DESIGN.md` updated with full verification records.
9. [x] Comprehensive `TESTING.md` authored; `README.md` verified.
10. [x] `backend/requirements.lock.txt` refreshed, frontend built, and FastAPI production serving verified.

## Commands

```powershell
cd C:\Users\shekh\OneDrive\Desktop\apptunix-rag-assistant
# Start all services (Ollama + Backend + Frontend + Browser) with one command:
npm start

& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" list
# If missing, resume downloads (Ollama reuses partial layers):
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull embeddinggemma
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull gemma3:4b

# Tests from project root:
backend\.venv\Scripts\python.exe -m pytest -q
backend\.venv\Scripts\python.exe -m ruff check backend\app tests scripts
backend\.venv\Scripts\python.exe scripts\evaluate.py

# Backend (new terminal, only if not already running):
cd backend
.\.venv\Scripts\python.exe -m app.ingest --source ..\knowledge
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend (separate terminal):
cd C:\Users\shekh\OneDrive\Desktop\apptunix-rag-assistant\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:browser
node tests/browser.mjs --live
npm.cmd run dev
```

## Known practical limits to describe honestly

- Prompt grounding and citation-ID validation reduce hallucinations but do not
  mathematically prove that every generated claim is entailed by a passage.
- Tokens are shown during generation; citation validation runs at completion.
- Chunks use character-based token estimation, not the model tokenizer.
- Source summaries are intentionally concise; many are shorter than 400 tokens.
- Browser source links require internet only when explicitly opened.
- Project is on OneDrive Desktop as requested. OneDrive may sync project files;
  “local processing” does not control the user's operating-system sync settings.
- No real screen-reader, physical mobile-device or complete WCAG certification test.
- Never confuse an automated keyword/citation test with a human factual audit.
