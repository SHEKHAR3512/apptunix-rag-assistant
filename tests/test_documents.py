from pathlib import Path

import pytest
from app.documents import chunks, clean, extract, metadata, sections
from pypdf import PdfWriter


def test_chunking_preserves_words_urls_and_overlap():
    url = "https://www.apptunix.com/android-app-development-company/"
    text = "\n\n".join(
        f"Section {i}. " + ("Apptunix develops mobile applications. " * 25) + url for i in range(8)
    )
    result = chunks(text)
    assert len(result) > 3
    assert all(len(c) <= 2400 for c in result)
    assert all(url in c for c in result)
    assert (
        result[0].split()[-20:] == result[1].split()[: len(result[1].split())][:20]
        or result[0].split()[-1] in result[1]
    )


def test_starter_citations_and_non_evidence_sections():
    text = "# Starter\n\n## Overview\n\n**Source:** https://www.apptunix.com/\n\nApptunix makes software.\n\n## Contact\n\n**Source:** https://www.apptunix.com/contact-us/\n\nEmail sales.\n\n## Test questions\n\nWhat is the salary?"
    result = list(sections(text, {}))
    assert len(result) == 2
    assert result[1][0]["source_url"].endswith("contact-us/")
    assert "salary" not in " ".join(body for _, body in result)


def test_metadata_and_cleaning(tmp_path):
    file = tmp_path / "doc.md"
    file.write_text(
        "---\ntitle: Test\nsource_url: https://www.apptunix.com/\nlast_checked: 2026-10-18\n---\n# Test\n\nSome   text.",
        encoding="utf-8",
    )
    meta, body = metadata(extract(file), file)
    assert meta["source_url"] == "https://www.apptunix.com/"
    assert meta["last_checked"] == "2026-10-18"
    assert "Some text." in body
    assert clean("a\x00\r\n\n\nb") == "a\n\nb"


def test_blank_pdf_reports_ocr(tmp_path):
    file = tmp_path / "scanned.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(file)
    with pytest.raises(ValueError, match="OCR"):
        extract(file)


def test_text_pdf_extraction(tmp_path):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 30 700 Td (Apptunix develops Android applications.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    file = tmp_path / "searchable.pdf"
    writer.write(file)
    assert "Apptunix develops Android" in extract(file)


def test_unsupported_extension():
    with pytest.raises(ValueError, match="Only Markdown"):
        extract(Path("file.exe"))
