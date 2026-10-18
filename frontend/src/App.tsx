import { useCallback, useEffect, useRef, useState } from "react";
import { api, safeUrl } from "./api";
import { useChat } from "./hooks/useChat";
import { Assistant } from "./components/Assistant";
import { Icon, Mark } from "./components/Icon";
import { Knowledge } from "./components/Knowledge";
import { Messages } from "./components/Messages";
import { Modal } from "./components/Modal";
import type { Health, Preferences, Source } from "./types";

const defaultPrefs: Preferences = {
  theme: "light",
  reducedMotion: false,
  model: "",
  topK: 4,
  strict: true,
};
function loadPreferences(): Preferences {
  try {
    return {
      ...defaultPrefs,
      ...JSON.parse(localStorage.getItem("apptunix.preferences.v1") || "{}"),
    };
  } catch {
    return defaultPrefs;
  }
}
const prompts = [
  {
    label: "Explore the company",
    question: "What is Apptunix, and what services does it offer?",
    icon: "globe",
  },
  {
    label: "Find the right expertise",
    question: "Does Apptunix develop Android and iOS applications?",
    icon: "code",
  },
  {
    label: "See the work",
    question: "What are some publicly documented Apptunix projects?",
    icon: "layers",
  },
  {
    label: "Start a conversation",
    question: "How can I contact Apptunix about a project?",
    icon: "chat",
  },
];

export default function App() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const chat = useChat(prefs);
  const [view, setView] = useState<"chat" | "knowledge" | "settings">("chat");
  const [health, setHealth] = useState<Health | null>(null),
    [healthError, setHealthError] = useState("");
  const [input, setInput] = useState(""),
    [source, setSource] = useState<Source | null>(null);
  const [mobile, setMobile] = useState(false),
    [clear, setClear] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const refreshHealth = useCallback(() => {
    void api<Health>("/health")
      .then((data) => {
        setHealth(data);
        setHealthError("");
      })
      .catch((e) => {
        setHealth(null);
        setHealthError(e.message);
      });
  }, []);
  useEffect(() => {
    refreshHealth();
    const timer = setInterval(refreshHealth, 12000);
    return () => clearInterval(timer);
  }, [refreshHealth]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.dataset.motion = prefs.reducedMotion
      ? "reduce"
      : "auto";
    try {
      localStorage.setItem("apptunix.preferences.v1", JSON.stringify(prefs));
    } catch {
      /* Session settings still work when persistence is unavailable. */
    }
  }, [prefs]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement;
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
      if (event.key !== "Tab") return;
      const items = [
        ...(sidebar.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ) || []),
      ].filter((el) => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [mobile]);
  const navigate = (next: typeof view) => {
    setView(next);
    setMobile(false);
  };
  const chosenModel = prefs.model || health?.chat_model || "gemma3:4b";
  const modelReady = health?.models.some(
    (m) => m === chosenModel || m === `${chosenModel}:latest`,
  );
  const ready =
    health?.ollama === "connected" && health.index_ready && modelReady;
  const send = (text = input) => {
    if (!text.trim() || chat.busy) return;
    setInput("");
    void chat.send(text);
    composer.current?.focus();
  };
  const newChat = () => {
    chat.select(null);
    navigate("chat");
    setInput("");
    setTimeout(() => composer.current?.focus(), 0);
  };
  const retry = () => {
    const last = [...(chat.current?.messages || [])]
      .reverse()
      .find((m) => m.role === "user");
    if (last) send(last.content);
  };
  const updatePref = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => setPrefs((p) => ({ ...p, [key]: value }));
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="brand">
          <Mark />
          <div>
            <strong>
              apptunix<span> /</span>
            </strong>
            <small>KNOWLEDGE DESK</small>
          </div>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="new-chat" disabled={chat.busy} onClick={newChat}>
          <Icon name="plus" />
          New conversation<kbd>＋</kbd>
        </button>
        <nav className="primary-nav" aria-label="Main">
          <button
            className={view === "chat" ? "selected" : ""}
            onClick={() => navigate("chat")}
          >
            <Icon name="chat" />
            The conversation
          </button>
          <button
            className={view === "knowledge" ? "selected" : ""}
            onClick={() => navigate("knowledge")}
          >
            <Icon name="book" />
            Knowledge library
            <span className="nav-count">{health?.documents ?? "—"}</span>
          </button>
        </nav>
        <div className="history-heading">
          <span>RECENT CONVERSATIONS</span>
          <button
            className="icon-button"
            disabled={!chat.conversations.length || chat.busy}
            aria-label="Clear conversation history"
            onClick={() => setClear(true)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
        <div className="history">
          {chat.conversations.length ? (
            [...chat.conversations]
              .sort((a, b) => b.updated - a.updated)
              .map((c) => (
                <button
                  key={c.id}
                  disabled={chat.busy}
                  className={
                    chat.active === c.id && view === "chat" ? "active" : ""
                  }
                  onClick={() => {
                    chat.select(c.id);
                    navigate("chat");
                  }}
                >
                  <Icon name="chat" size={16} />
                  <span>{c.title}</span>
                </button>
              ))
          ) : (
            <p>
              Your next good question
              <br />
              starts a new conversation.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <div>
              <span className={`status-dot ${ready ? "online" : ""}`} />
              <strong>
                {ready ? "Running on your device" : "Local system status"}
              </strong>
            </div>
            <p>
              {healthError
                ? "Backend disconnected"
                : health?.ollama === "connected"
                  ? `${health.chunks} searchable passages`
                  : "Waiting for Ollama"}
            </p>
            <div className="local-line">
              <Icon name="shield" size={15} />
              <span>Your questions stay local</span>
            </div>
          </div>
          <button
            className={
              view === "settings" ? "settings-link selected" : "settings-link"
            }
            onClick={() => navigate("settings")}
          >
            <Icon name="settings" />
            Settings & models
            <Icon name="arrow" size={16} />
          </button>
          <div className="sidebar-footer">
            <span>INDEPENDENT DEMO</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={mobile || undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {view === "chat"
                ? "Ask Apptunix"
                : view === "knowledge"
                  ? "Knowledge library"
                  : "Settings & models"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span className={`status-dot ${ready ? "online" : ""}`} />
              {ready ? "Local & ready" : "Setup status"}
            </span>
            <button
              className="icon-button"
              aria-label={`Switch to ${prefs.theme === "light" ? "dark" : "light"} theme`}
              onClick={() =>
                updatePref("theme", prefs.theme === "light" ? "dark" : "light")
              }
            >
              <Icon name={prefs.theme === "light" ? "moon" : "sun"} />
            </button>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={view === "chat" ? "chat-main" : "page-main"}
        >
          {view === "chat" && (
            <>
              {(healthError || (health && !ready)) && (
                <div className="connection-banner" role="status">
                  <Icon name="alert" size={18} />
                  <span>
                    {healthError ||
                      health?.error ||
                      (health?.ollama !== "connected"
                        ? "Start Ollama to use your local models."
                        : "Your knowledge base needs indexing.")}
                  </span>
                  <button
                    onClick={() =>
                      health?.ollama === "connected"
                        ? navigate("knowledge")
                        : refreshHealth()
                    }
                  >
                    {health?.ollama === "connected"
                      ? "Open library"
                      : "Check again"}
                  </button>
                </div>
              )}
              {chat.storageError && (
                <p role="alert" className="connection-banner">
                  {chat.storageError}
                </p>
              )}
              {chat.current?.messages.length ? (
                <>
                  <h1 className="sr-only">{chat.current.title}</h1>
                  <Messages
                    messages={chat.current.messages}
                    busy={chat.busy}
                    stage={chat.stage}
                    openSource={setSource}
                    retry={retry}
                  />
                </>
              ) : (
                <div className="welcome-scroll">
                  <section className="welcome">
                    <div className="welcome-kicker">
                      <span className="tiny-line" /> KNOW THE COMPANY. SEE THE
                      EVIDENCE.
                    </div>
                    <Assistant reduced={prefs.reducedMotion} />
                    <h1>
                      A little curiosity.
                      <br />
                      <span>A lot of clarity.</span>
                    </h1>
                    <p className="welcome-description">
                      Explore Apptunix, one question at a time.
                      <br />
                      Thoughtful answers, grounded in public sources. Entirely
                      local.
                    </p>
                    <div className="evidence-path">
                      <span>
                        <i>01</i>Your question
                      </span>
                      <span className="path-line" />
                      <span>
                        <i>02</i>Relevant sources
                      </span>
                      <span className="path-line" />
                      <span>
                        <i>03</i>A clear answer
                      </span>
                    </div>
                    <div className="suggestion-heading">
                      <span>A GOOD PLACE TO START</span>
                      <span>
                        Pick a question <Icon name="arrow" size={14} />
                      </span>
                    </div>
                    <div className="suggestions">
                      {prompts.map((p, i) => (
                        <button
                          key={p.label}
                          onClick={() => send(p.question)}
                          disabled={chat.busy}
                        >
                          <div className="suggestion-top">
                            <Icon name={p.icon} />
                            <span>0{i + 1}</span>
                          </div>
                          <strong>{p.label}</strong>
                          <span className="suggestion-question">
                            {p.question}
                          </span>
                          <Icon name="arrow" size={17} />
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
              <div className="composer-area">
                <form
                  className={`composer ${chat.busy ? "busy" : ""}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <label htmlFor="question" className="sr-only">
                    Ask about Apptunix
                  </label>
                  <textarea
                    id="question"
                    ref={composer}
                    rows={2}
                    maxLength={2000}
                    value={input}
                    placeholder="What would you like to know about Apptunix?"
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <span>
                      <Icon name="book" size={15} />
                      {health?.index_ready
                        ? "Company knowledge"
                        : "Public sources only"}
                      <span className="composer-model">
                        {" "}
                        · {prefs.model || health?.chat_model || "gemma3:4b"}
                      </span>
                    </span>
                    {chat.busy ? (
                      <button
                        className="send-button stop-button"
                        type="button"
                        aria-label="Stop generation"
                        onClick={chat.stop}
                      >
                        <Icon name="stop" size={18} />
                      </button>
                    ) : (
                      <button
                        className="send-button"
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send question"
                      >
                        <Icon name="send" />
                      </button>
                    )}
                  </div>
                </form>
                <div className="composer-note">
                  <span>
                    Independent demo — not an official Apptunix support channel.
                  </span>
                  <span className="enter-hint">
                    Enter to send <kbd>↵</kbd>
                  </span>
                </div>
              </div>
            </>
          )}
          {view === "knowledge" && <Knowledge refreshHealth={refreshHealth} />}
          {view === "settings" && (
            <section className="page-content settings-page">
              <div className="eyebrow">YOUR DEVICE. YOUR WORKSPACE.</div>
              <h1>
                Intelligence,
                <br />
                on your terms.
              </h1>
              <p className="page-intro">
                Local models, considered defaults, and a little room to make it
                yours.
              </p>
              <section className="settings-section">
                <h2>Local system</h2>
                <dl className="system-list">
                  <div>
                    <dt>Python backend</dt>
                    <dd>{health ? "Connected" : "Disconnected"}</dd>
                  </div>
                  <div>
                    <dt>Ollama</dt>
                    <dd>{health?.ollama || "Checking…"}</dd>
                  </div>
                  <div>
                    <dt>Embedding model</dt>
                    <dd>{health?.embedding_model || "embeddinggemma"}</dd>
                  </div>
                  <div>
                    <dt>Knowledge base</dt>
                    <dd>
                      {health?.index_ready
                        ? `${health.documents} documents · ${health.chunks} passages`
                        : "Not ready"}
                    </dd>
                  </div>
                </dl>
                <button onClick={refreshHealth}>
                  <Icon name="refresh" size={17} />
                  Refresh status
                </button>
                {(healthError || health?.error) && (
                  <p className="error-text" role="status">
                    {healthError || health?.error}
                  </p>
                )}
              </section>
              <section className="settings-section">
                <h2>Answers & retrieval</h2>
                <label className="field">
                  Chat model
                  <select
                    value={prefs.model}
                    onChange={(e) => updatePref("model", e.target.value)}
                  >
                    <option value="">
                      Default · {health?.chat_model || "gemma3:4b"}
                    </option>
                    {health?.models
                      .filter((m) => !m.includes("embed"))
                      .map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                  </select>
                  <small>
                    Only models downloaded to local Ollama are available.
                  </small>
                </label>
                <label className="field">
                  Retrieved passages: {prefs.topK}
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={prefs.topK}
                    onChange={(e) => updatePref("topK", Number(e.target.value))}
                  />
                  <small>
                    More passages add context, but may slow down your answer.
                  </small>
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>Stricter retrieval</strong>
                    <small>
                      Raise the relevance threshold. Grounding is always
                      required.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={prefs.strict}
                    onChange={(e) => updatePref("strict", e.target.checked)}
                  />
                </label>
              </section>
              <section className="settings-section">
                <h2>Make yourself comfortable</h2>
                <label className="field">
                  Appearance
                  <select
                    value={prefs.theme}
                    onChange={(e) =>
                      updatePref("theme", e.target.value as "light" | "dark")
                    }
                  >
                    <option value="light">Light · Paper & ink</option>
                    <option value="dark">Dark · After hours</option>
                  </select>
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>Reduce motion</strong>
                    <small>
                      Your system's reduced-motion preference is also respected.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={prefs.reducedMotion}
                    onChange={(e) =>
                      updatePref("reducedMotion", e.target.checked)
                    }
                  />
                </label>
              </section>
              <section className="settings-section">
                <h2>Conversation history</h2>
                <p>
                  Stored only in this browser, up to 50 conversations. Source
                  links open externally only when you choose them.
                </p>
                <button
                  className="danger-button"
                  disabled={chat.busy || !chat.conversations.length}
                  onClick={() => setClear(true)}
                >
                  <Icon name="trash" size={17} />
                  Clear conversation history
                </button>
              </section>
            </section>
          )}
        </main>
      </div>
      {source && (
        <Modal title="Behind the answer" close={() => setSource(null)}>
          <div className="source-detail">
            <span className="eyebrow">PASSAGE {source.id}</span>
            <h3>{source.title}</h3>
            <p className="muted">Source checked: {source.last_checked}</p>
            <blockquote>{source.passage}</blockquote>
            <p className="small-text muted">{source.path}</p>
            {safeUrl(source.source_url) && (
              <a
                className="button primary"
                href={safeUrl(source.source_url)}
                target="_blank"
                rel="noreferrer"
              >
                Open original source <Icon name="link" size={17} />
              </a>
            )}
            <p className="small-text muted">
              The saved passage is available offline. Opening the original
              website requires internet.
            </p>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal
          title="Clear local conversation history?"
          close={() => setClear(false)}
        >
          <p>
            This removes saved chats from this browser. Your knowledge documents
            and local models are kept.
          </p>
          <div className="dialog-actions">
            <button onClick={() => setClear(false)}>Keep conversations</button>
            <button
              className="danger-button"
              onClick={() => {
                chat.clear();
                setClear(false);
              }}
            >
              Clear history
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
