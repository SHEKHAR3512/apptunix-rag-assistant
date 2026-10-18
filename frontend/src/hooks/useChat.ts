import { useEffect, useRef, useState } from "react";
import { readStream } from "../api";
import type { Conversation, Message, Preferences } from "../types";

const KEY = "apptunix.conversations.v1";
function load(): Conversation[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (c) =>
          typeof c?.id === "string" &&
          typeof c?.title === "string" &&
          Array.isArray(c?.messages) &&
          c.messages.every(
            (m: Message) =>
              typeof m.content === "string" && Array.isArray(m.sources),
          ),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function useChat(preferences: Preferences) {
  const [conversations, setConversations] = useState<Conversation[]>(load);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [storageError, setStorageError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(conversations.slice(0, 50)));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is full or disabled. This conversation is only saved for this session.",
      );
    }
  }, [conversations]);
  useEffect(() => () => controller.current?.abort(), []);
  const current = conversations.find((c) => c.id === active);
  const patch = (cid: string, mid: string, update: (m: Message) => Message) => {
    setConversations((all) =>
      all.map((c) =>
        c.id === cid
          ? {
              ...c,
              messages: c.messages.map((m) => (m.id === mid ? update(m) : m)),
            }
          : c,
      ),
    );
  };
  const send = async (question: string) => {
    if (!question.trim() || controller.current) return;
    const cid = active || crypto.randomUUID(),
      mid = crypto.randomUUID();
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.trim(),
      sources: [],
    };
    const assistant: Message = {
      id: mid,
      role: "assistant",
      content: "",
      sources: [],
    };
    const history =
      current?.messages
        .filter((m) => !m.error && !m.stopped)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) })) ||
      [];
    setConversations((all) =>
      active
        ? all.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  updated: Date.now(),
                  messages: [...c.messages, user, assistant],
                }
              : c,
          )
        : [
            {
              id: cid,
              title: question.trim().slice(0, 70),
              updated: Date.now(),
              messages: [user, assistant],
            },
            ...all,
          ].slice(0, 50),
    );
    setActive(cid);
    setBusy(true);
    setStage("searching");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          history,
          model: preferences.model || null,
          top_k: preferences.topK,
          strict: preferences.strict,
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Chat failed (${response.status}). Check local services and retry.`,
        );
      }
      if (!response.body)
        throw new Error("Streaming is unavailable in this browser.");
      await readStream(response.body, (event) => {
        if (event.type === "status") setStage(event.stage || "searching");
        if (event.type === "token")
          patch(cid, mid, (m) => ({
            ...m,
            content: m.content + (event.text || ""),
          }));
        if (event.type === "replace")
          patch(cid, mid, (m) => ({ ...m, content: event.text || "" }));
        if (event.type === "sources")
          patch(cid, mid, (m) => ({ ...m, sources: event.sources || [] }));
        if (event.type === "error")
          patch(cid, mid, (m) => ({
            ...m,
            error: event.message || "Unable to answer. Please retry.",
          }));
      });
    } catch (error) {
      if (abort.signal.aborted)
        patch(cid, mid, (m) => ({ ...m, stopped: true }));
      else
        patch(cid, mid, (m) => ({
          ...m,
          error:
            error instanceof TypeError
              ? "Backend is unavailable. Start the Python server, then retry."
              : (error as Error).message,
        }));
    } finally {
      controller.current = null;
      setBusy(false);
      setStage("");
    }
  };
  return {
    conversations,
    active,
    current,
    busy,
    stage,
    storageError,
    send,
    stop: () => controller.current?.abort(),
    select: (id: string | null) => {
      if (!controller.current) setActive(id);
    },
    clear: () => {
      if (!controller.current) {
        setConversations([]);
        setActive(null);
      }
    },
  };
}
