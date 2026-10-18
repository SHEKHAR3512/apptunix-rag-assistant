import { useEffect, useState } from "react";
import { api, safeUrl } from "../api";
import type { IndexStatus, Source } from "../types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function Knowledge({ refreshHealth }: { refreshHealth: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true),
    [uploading, setUploading] = useState(false);
  const [approved, setApproved] = useState(false),
    [confirm, setConfirm] = useState(false);
  const busy = status?.state === "running";
  const load = async () => {
    try {
      setSources((await api<{ sources: Source[] }>("/sources")).sources);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    void api<IndexStatus>("/index/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void api<IndexStatus>("/index/status")
        .then((data) => {
          setStatus(data);
          if (data.state !== "running") {
            void load();
            refreshHealth();
          }
        })
        .catch((e) => {
          setError(e.message);
          setStatus((s) => (s ? { ...s, state: "error" } : s));
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [busy, refreshHealth]);
  const index = async (reset = false) => {
    setError("");
    setConfirm(false);
    try {
      await api("/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset, confirm_reset: reset }),
      });
      setStatus({
        state: "running",
        completed: 0,
        total: 0,
        chunks: 0,
        skipped: 0,
        current: "Preparing",
        errors: [],
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const upload = async (file?: File) => {
    if (!file || !approved) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await api<{ message: string }>("/documents", {
        method: "POST",
        body,
      });
      setNotice(result.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <section className="page-content knowledge-page">
      <div className="eyebrow">THE EVIDENCE ROOM</div>
      <h1>
        Good answers start
        <br />
        with good sources.
      </h1>
      <p className="page-intro">
        A local collection of public Apptunix information. Every indexed passage
        keeps its source and review date.
      </p>
      <div className="library-toolbar">
        <span>
          <strong>{sources.length}</strong> indexed documents
        </span>
        <button
          className="primary"
          disabled={busy || uploading}
          onClick={() => void index()}
        >
          <Icon name="refresh" />
          {busy ? "Indexing…" : "Update index"}
        </button>
      </div>
      {error && (
        <div className="error-box" role="alert">
          <Icon name="alert" />
          <div>
            {error}
            <button onClick={() => void load()}>Retry loading</button>
          </div>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          <Icon name="check" />
          {notice}
        </p>
      )}
      {status && status.state !== "idle" && (
        <div className="index-status" role="status">
          <strong>
            {busy
              ? "Building searchable knowledge"
              : status.state === "done"
                ? "Index is up to date"
                : "Indexing needs attention"}
          </strong>
          <p>
            {status.completed} / {status.total} files processed ·{" "}
            {status.chunks} chunks embedded · {status.skipped} unchanged or
            duplicate files
          </p>
          {busy && (
            <>
              <progress
                value={status.completed}
                max={Math.max(status.total, 1)}
              />
              <small>{status.current}</small>
            </>
          )}
          {status.errors.map((e, i) => (
            <p className="error-text" key={i}>
              {e.file}: {e.error}
            </p>
          ))}
        </div>
      )}
      <div className="document-list">
        {loading ? (
          <p role="status">Loading your local library…</p>
        ) : sources.length ? (
          sources.map((s, i) => (
            <article className="document-row" key={s.path}>
              <span className="document-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon name="file" />
              <div>
                <h2>{s.title}</h2>
                <p>
                  Checked {s.last_checked} <span>·</span> {s.chunks}{" "}
                  {s.chunks === 1 ? "passage" : "passages"}
                </p>
                <small>{s.path}</small>
              </div>
              {safeUrl(s.source_url) && (
                <a
                  href={safeUrl(s.source_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label={`Open original: ${s.title}`}
                >
                  <Icon name="link" />
                </a>
              )}
            </article>
          ))
        ) : (
          <div className="library-empty">
            <Icon name="book" size={36} />
            <h2>Your sources are ready to be indexed</h2>
            <p>
              Choose Update index to turn the approved documents into searchable
              knowledge.
            </p>
          </div>
        )}
      </div>
      <section className="upload-panel">
        <div>
          <Icon name="upload" />
          <h2>Add to the collection</h2>
          <p>Markdown, text or searchable PDF · up to 10 MB</p>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          I have approval to use this document in the local knowledge base.
        </label>
        <label
          className={`button upload-button ${!approved || busy ? "disabled" : ""}`}
        >
          <Icon name="plus" />
          {uploading ? "Adding document…" : "Choose a document"}
          <input
            aria-label="Choose an approved document"
            type="file"
            accept=".md,.txt,.pdf"
            disabled={!approved || busy || uploading}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </section>
      <div className="rebuild-row">
        <div>
          <h2>Changed your embedding model?</h2>
          <p>
            A full rebuild replaces vectors using the current model. Your
            documents stay intact.
          </p>
        </div>
        <button disabled={busy} onClick={() => setConfirm(true)}>
          Full rebuild
        </button>
      </div>
      {confirm && (
        <Modal
          title="Rebuild the entire index?"
          close={() => setConfirm(false)}
        >
          <p>
            This re-embeds every approved document. The existing index will be
            replaced after document processing succeeds.
          </p>
          <div className="dialog-actions">
            <button onClick={() => setConfirm(false)}>Cancel</button>
            <button className="primary" onClick={() => void index(true)}>
              Rebuild index
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
