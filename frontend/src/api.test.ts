import { describe, expect, it } from "vitest";
import { readStream, safeUrl } from "./api";
import type { StreamEvent } from "./types";

function stream(text: string, split: number) {
  const data = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < data.length; i += split)
        controller.enqueue(data.slice(i, i + split));
      controller.close();
    },
  });
}
describe("stream protocol", () => {
  it("decodes fragmented UTF-8 and a final line without a newline", async () => {
    const events: StreamEvent[] = [];
    await readStream(
      stream('{"type":"token","text":"Hello — दुनिया"}\n{"type":"done"}', 1),
      (event) => events.push(event),
    );
    expect(events[0].text).toBe("Hello — दुनिया");
    expect(events[1].type).toBe("done");
  });
  it("rejects incomplete streams instead of leaving a spinner", async () => {
    await expect(
      readStream(stream('{"type":"token","text":"partial"}\n', 3), () => {}),
    ).rejects.toThrow("interrupted");
  });
  it("accepts explicit errors as terminal events", async () => {
    const result: StreamEvent[] = [];
    await readStream(
      stream('{"type":"error","message":"Disconnected"}\n', 5),
      (event) => result.push(event),
    );
    expect(result[0].message).toBe("Disconnected");
  });
  it("rejects malformed events", async () => {
    await expect(
      readStream(stream("not JSON\n", 2), () => {}),
    ).rejects.toThrow();
  });
});
describe("source URL safety", () => {
  it("allows source websites but rejects executable and filesystem URLs", () => {
    expect(safeUrl("https://www.apptunix.com/")).toBe(
      "https://www.apptunix.com/",
    );
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("file:///C:/secret")).toBeUndefined();
  });
});
