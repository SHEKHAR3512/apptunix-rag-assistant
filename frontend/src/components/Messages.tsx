import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message, Source } from "../types";
import { Icon, Mark } from "./Icon";
import { safeUrl } from "../api";

export function Messages({
  messages,
  busy,
  stage,
  openSource,
  retry,
}: {
  messages: Message[];
  busy: boolean;
  stage: string;
  openSource: (source: Source) => void;
  retry: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    if (stick.current && container.current)
      container.current.scrollTop = container.current.scrollHeight;
  }, [messages, busy]);
  return (
    <div
      className="message-scroll"
      ref={container}
      onScroll={() => {
        const el = container.current!;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      }}
    >
      <div className="message-list">
        {messages.map((message, i) => (
          <MessageView
            key={message.id}
            message={message}
            streaming={busy && i === messages.length - 1}
            stage={stage}
            openSource={openSource}
            retry={retry}
          />
        ))}
      </div>
    </div>
  );
}
function MessageView({
  message,
  streaming,
  stage,
  openSource,
  retry,
}: {
  message: Message;
  streaming: boolean;
  stage: string;
  openSource: (s: Source) => void;
  retry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Clipboard unavailable. Select the answer text to copy it.");
    }
  };
  if (message.role === "user")
    return (
      <article className="message user-message">
        <span className="speaker">You</span>
        <p>{message.content}</p>
      </article>
    );
  return (
    <article
      className={`message assistant-message ${streaming ? "streaming" : ""}`}
      aria-busy={streaming}
    >
      <div className="answer-heading">
        <Mark small />
        <span className="speaker">Knowledge assistant</span>
        <span className="tiny-label">LOCAL AI</span>
      </div>
      {streaming && (
        <div className="processing" role="status">
          <span className={`retrieval-map ${stage}`} aria-hidden="true">
            <i />
            <b />
            <i />
            <b />
            <i />
          </span>
          {stage === "writing"
            ? "Writing from retrieved sources"
            : "Searching company knowledge"}
        </div>
      )}
      <div className="prose">
        <ReactMarkdown
          components={{
            img: () => null,
            a: ({ href, children }) => (
              <a href={safeUrl(href || "")} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.error && (
        <div className="error-box" role="alert">
          <Icon name="alert" />
          <div>
            {message.error}
            <br />
            <button disabled={streaming} onClick={retry}>
              Retry question <Icon name="refresh" size={16} />
            </button>
          </div>
        </div>
      )}
      {message.stopped && (
        <p className="muted small-text">
          Generation stopped. This partial answer has not been verified.
        </p>
      )}
      {!!message.sources.length && (
        <div className="source-chips" aria-label="Answer sources">
          {message.sources.map((source) => (
            <button key={source.id} onClick={() => openSource(source)}>
              <span>{source.id}</span>
              {source.title}
              <Icon name="link" size={14} />
            </button>
          ))}
        </div>
      )}
      {!streaming && message.content && (
        <div className="answer-actions">
          <button
            onClick={copy}
            aria-label={copied ? "Answer copied" : "Copy answer"}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? "Copied" : "Copy answer"}
          </button>
          {!!message.sources.length && (
            <span>
              <Icon name="check" size={14} /> {message.sources.length} cited{" "}
              {message.sources.length === 1 ? "passage" : "passages"}
            </span>
          )}
        </div>
      )}
      {copyError && <p role="status">{copyError}</p>}
    </article>
  );
}
