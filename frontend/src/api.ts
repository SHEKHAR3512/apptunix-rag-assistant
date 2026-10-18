import type { StreamEvent } from "./types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new Error(
      "Backend is unavailable. Start the Python server and retry.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status}). Please retry.`,
    );
  }
  return response.json() as Promise<T>;
}

export async function readStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    complete = false;
  const dispatch = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "done" || event.type === "error") complete = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(dispatch);
    }
    buffer += decoder.decode();
    dispatch(buffer);
    if (!complete)
      throw new Error("The response was interrupted. Retry your question.");
  } finally {
    reader.releaseLock();
  }
}

export function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
