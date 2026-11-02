import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as quote from "#quote";

const compiled = ts.transpileModule(
  readFileSync(new URL("../client/web.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function harness(platform = "web") {
  const listeners = new Map<string, (event?: unknown) => void>();
  const inside = {};
  const outside = {};
  const selection = {
    isCollapsed: false, rangeCount: 1, anchorNode: inside, focusNode: inside,
    toString: () => "selected excerpt",
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 25, bottom: 45, left: 30 }) }),
  };
  const events = {
    addEventListener: (type: string, fn: (event?: unknown) => void) => listeners.set(type, fn),
    removeEventListener: (type: string, fn: (event?: unknown) => void) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  };
  const api = {} as {
    observeMessageSelection(id: string, fn: (value: { text: string; top: number; left: number } | null) => void): () => void;
    observeReplySubmitKey(id: string, fn: () => void): () => void;
  };
  runInNewContext(compiled, {
    exports: api,
    require: (name: string) => {
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "@/shared/quote") return quote;
      throw new Error(`Unexpected import: ${name}`);
    },
    document: {
      ...events,
      getSelection: () => selection,
      getElementById: (id: string) => id === "message-1" ? {
        contains: (node: unknown) => node === inside,
        getBoundingClientRect: () => ({ top: 10, left: 20, bottom: 100 }),
      } : null,
    },
    window: events,
  });
  return { api, listeners, selection, inside, outside };
}

test("selection observer scopes the excerpt, clears stale state and removes listeners", () => {
  const h = harness();
  let latest: { text: string; top: number; left: number } | null = null;
  const dispose = h.api.observeMessageSelection("message-1", (value) => { latest = value; });
  h.listeners.get("selectionchange")!();
  assert.equal(JSON.stringify(latest), JSON.stringify({ text: "selected excerpt", top: 35, left: 10 }));
  h.selection.focusNode = h.outside;
  h.listeners.get("selectionchange")!();
  assert.equal(latest, null);
  h.selection.focusNode = h.inside;
  h.listeners.get("selectionchange")!();
  h.listeners.get("scroll")!();
  assert.equal(latest, null);
  dispose();
  assert.equal(h.listeners.size, 0);
});

test("reply input handler isolates Enter and leaves IME and Shift+Enter untouched", () => {
  const h = harness();
  let sent = 0;
  let prevented = 0;
  let stopped = 0;
  const dispose = h.api.observeReplySubmitKey("reply-1", () => { sent++; });
  const event = {
    key: "Enter", shiftKey: false, isComposing: false, target: { id: "reply-1" },
    preventDefault: () => { prevented++; }, stopPropagation: () => { stopped++; },
  };
  h.listeners.get("keydown")!({ ...event, target: { id: "main-composer" } });
  h.listeners.get("keydown")!({ ...event, shiftKey: true });
  h.listeners.get("keydown")!({ ...event, isComposing: true });
  assert.deepEqual([sent, prevented, stopped], [0, 0, 0]);
  h.listeners.get("keydown")!(event);
  assert.deepEqual([sent, prevented, stopped], [1, 1, 1]);
  dispose();
  assert.equal(h.listeners.size, 0);
});

test("native clients do not register browser listeners", () => {
  const h = harness("ios");
  h.api.observeMessageSelection("message-1", () => assert.fail("native selection"))();
  h.api.observeReplySubmitKey("reply-1", () => assert.fail("native send"))();
  assert.equal(h.listeners.size, 0);
});
