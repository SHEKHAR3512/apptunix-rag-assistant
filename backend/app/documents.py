"""Extraction and paragraph-first approximate token chunking; no model downloads."""

import hashlib
import re
from pathlib import Path

from pypdf import PdfReader

ALLOWED = {".md", ".txt", ".pdf"}
MAX_BYTES = 10 * 1024 * 1024


def clean(text: str) -> str:
    text = text.replace("\x00", "").replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract(path: Path) -> str:
    if path.suffix.lower() not in ALLOWED:
        raise ValueError("Only Markdown, TXT and PDF documents are supported.")
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Document exceeds the 10 MB limit.")
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF: export an unlocked, approved copy first.")
        if len(reader.pages) > 300:
            raise ValueError("PDF exceeds the 300-page limit.")
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        if len(text.strip()) < 20:
            raise ValueError("PDF has no usable text. Run OCR and upload a searchable PDF.")
    else:
        text = path.read_text(encoding="utf-8-sig")
    text = clean(text)
    if not text:
        raise ValueError("The document contains no readable text.")
    return text


def metadata(text: str, path: Path) -> tuple[dict, str]:
    meta = {
        "title": path.stem.replace("-", " "),
        "source_url": "",
        "last_checked": "Unknown",
        "visibility": "user_approved",
        "review_status": "user_approved",
    }
    if text.startswith("---\n") and "\n---" in text[4:]:
        header, text = text[4:].split("\n---", 1)
        for line in header.splitlines():
            key, sep, value = line.partition(":")
            if sep and key.strip() in meta:
                meta[key.strip()] = value.strip().strip("\"'")
    title = re.search(r"^# (.+)$", text, re.M)
    if title:
        meta["title"] = title.group(1)
    return meta, text.strip()


def chunks(text: str, target: int = 2000, overlap: int = 320) -> list[str]:
    """~500 tokens / ~80 overlap using the documented 4 chars/token estimate.

    Prefer paragraph boundaries; unusually long paragraphs split at whitespace,
    never inside a URL. Small documents remain small rather than being padded.
    """
    units = []
    for paragraph in re.split(r"\n\s*\n", text):
        if len(paragraph) <= target:
            units.append(paragraph)
            continue
        words = paragraph.split()
        part = ""
        for word in words:
            if part and len(part) + len(word) + 1 > target:
                units.append(part)
                part = ""
            part += (" " if part else "") + word
        if part:
            units.append(part)
    result, current = [], ""
    for unit in units:
        if current and len(current) + len(unit) + 2 > target + 400:
            result.append(current.strip())
            tail = current[-overlap:]
            current = tail.split(" ", 1)[-1] if " " in tail else ""
        current += ("\n\n" if current else "") + unit
    if current.strip():
        result.append(current.strip())
    return list(dict.fromkeys(result))


def sections(text: str, meta: dict):
    # The supplied starter contains distinct URLs in each section. Do not assign
    # its first URL to every chunk or embed the evaluation/backlog instructions.
    if "**Source:**" in text:
        for section in re.split(r"(?=^## )", text, flags=re.M):
            match = re.search(r"\*\*Source:\*\*\s*(https?://\S+)", section)
            if match:
                yield (
                    {
                        **meta,
                        "source_url": match.group(1),
                        "last_checked": "2026-10-18",
                        "review_status": "supplied_reviewed_starter",
                    },
                    section,
                )
    else:
        yield meta, text


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()
