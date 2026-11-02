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

type Node = { parentElement: Element | null; nodeType: number };
class Element implements Node {
  readonly nodeType = 1;
  parentElement: Element | null = null;
  children: Element[] = [];
  style = { display: "flex" };
  textContent: string | null = "Assistant response";
  readonly attributes: Record<string, string>;
  constructor(attributes: Record<string, string> = {}) { this.attributes = attributes; }
  get isConnected(): boolean {
    return this.attributes.root === "body" || (this.parentElement?.isConnected ?? false);
  }
  append(child: Element) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  contains(node: unknown): boolean {
    for (let current = node as Node | null; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }
  matches(selector: string): boolean {
    if (selector.includes(",")) return selector.split(",").some((part) => this.matches(part.trim()));
    if (selector === "input" || selector === "textarea") return this.attributes.tag === selector;
    if (selector === "[data-message-id]") return "data-message-id" in this.attributes;
    const match = /^\[([^=\^]+)(\^?=)"([^"]*)"\]$/.exec(selector);
    if (!match) throw new Error(`Unsupported mock selector: ${selector}`);
    const value = this.attributes[match[1]!];
    return match[2] === "^=" ? value?.startsWith(match[3]!) === true : value === match[3];
  }
  closest(selector: string): Element | null {
    for (let current: Element | null = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
}

type Listener = (event: unknown) => void;
function eventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
      if (!listeners.get(type)?.size) listeners.delete(type);
    },
    emit(type: string, event: unknown = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

interface Selection {
  text: string;
  messageId: string;
  top: number;
  left: number;
  viewportWidth: number;
  viewportHeight: number;
  isValid(): boolean;
}

function harness(platform = "web") {
  const body = new Element({ root: "body" });
  const documentEvents = eventTarget();
  const windowEvents = eventTarget();
  const observers: Array<{ active: boolean; callback: () => void }> = [];
  function pane(name: string) {
    const container = body.append(new Element());
    const chat = container.append(new Element({ "data-testid": "agent-chat-scroll" }));
    const row = chat.append(new Element({ "data-message-id": `${name}-message` }));
    const assistant = row.append(new Element({ "data-testid": "assistant-message" }));
    const textNode: Node = { nodeType: 3, parentElement: assistant };
    const composer = container.append(new Element());
    const unrelatedButton = composer.append(new Element({ role: "button" }));
    const button = composer.append(new Element({ role: "button" }));
    const marker = button.append(new Element({ id: `quote-reply-anchor-${name}` }));
    return { container, chat, row, assistant, textNode, composer, unrelatedButton, button, marker };
  }
  const first = pane("first");
  const second = pane("second");
  const selection = {
    isCollapsed: false, rangeCount: 1,
    anchorNode: first.textNode as Node | null,
    focusNode: first.textNode as Node | null,
    text: "selected excerpt",
    toString() { return this.text; },
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 25, bottom: 45, left: 30 }) }),
  };
  const api = {} as {
    observeNativeMessageSelection(id: string, fn: (value: Selection | null) => void): () => void;
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
      ...documentEvents, body,
      getSelection: () => selection,
      getElementById: (id: string) => body.querySelectorAll(`[id="${id}"]`)[0] ?? null,
    },
    window: { ...windowEvents, innerWidth: 1000, innerHeight: 800 },
    MutationObserver: class {
      entry: { active: boolean; callback: () => void };
      constructor(callback: () => void) {
        this.entry = { active: false, callback };
        observers.push(this.entry);
      }
      observe() { this.entry.active = true; }
      disconnect() { this.entry.active = false; }
    },
  });
  const changes: Array<Selection | null> = [];
  function observe(marker = first.marker, output = changes) {
    return api.observeNativeMessageSelection(marker.attributes.id!, (value) => output.push(value));
  }
  function release(target: Node = first.assistant) { documentEvents.emit("pointerup", { target }); }
  return {
    api, body, first, second, selection, documentEvents, windowEvents, observers, changes, observe, release,
    latest: () => changes.at(-1),
    mutate() { observers.filter((entry) => entry.active).forEach((entry) => entry.callback()); },
  };
}

test("split panes resolve the exact source and hide only each observer's own button", () => {
  const h = harness();
  const stopFirst = h.observe();
  assert.equal(h.first.button.style.display, "none");
  assert.equal(h.second.button.style.display, "flex");
  assert.equal(h.first.unrelatedButton.style.display, "flex");
  const secondChanges: Array<Selection | null> = [];
  const stopSecond = h.observe(h.second.marker, secondChanges);
  h.release();
  assert.equal(h.latest()?.messageId, "first-message");
  assert.equal(secondChanges.at(-1), null);
  assert.equal(h.latest()?.isValid(), true);
  assert.deepEqual(
    [h.latest()?.text, h.latest()?.top, h.latest()?.left, h.latest()?.viewportWidth, h.latest()?.viewportHeight],
    ["selected excerpt", 51, 30, 1000, 800],
  );
  h.selection.anchorNode = h.second.textNode;
  h.selection.focusNode = h.second.textNode;
  h.release(h.second.assistant);
  assert.equal(h.latest(), null);
  assert.equal(secondChanges.at(-1)?.messageId, "second-message");
  stopFirst();
  assert.equal(h.first.button.style.display, "flex");
  assert.equal(h.second.button.style.display, "none");
  stopSecond();
});

test("cross-message, cross-pane, blank, collapsed and missing-checkpoint selections are rejected", () => {
  const h = harness();
  h.observe();
  const otherRow = h.first.chat.append(new Element({ "data-message-id": "another" }));
  const otherAssistant = otherRow.append(new Element({ "data-testid": "assistant-message" }));
  for (const focus of [otherAssistant, h.second.textNode, h.first.composer, null]) {
    h.selection.focusNode = focus;
    h.release();
    assert.equal(h.latest(), null);
  }
  h.selection.focusNode = h.first.textNode;
  h.selection.text = " \n ";
  h.release();
  assert.equal(h.latest(), null);
  h.selection.text = "excerpt";
  h.selection.isCollapsed = true;
  h.release();
  assert.equal(h.latest(), null);
  h.selection.isCollapsed = false;
  h.selection.rangeCount = 0;
  h.release();
  assert.equal(h.latest(), null);
  h.selection.rangeCount = 1;
  delete h.first.row.attributes["data-message-id"];
  h.release();
  assert.equal(h.latest(), null);
});

test("ambiguous panes with multiple chats or markers and body-only scope fail closed", () => {
  for (const ambiguity of ["chats", "markers", "body"]) {
    const h = harness();
    if (ambiguity === "chats") {
      h.first.container.append(new Element({ "data-testid": "agent-chat-scroll" }));
    } else if (ambiguity === "markers") {
      h.first.composer.append(new Element({ id: "quote-reply-anchor-duplicate" }));
    } else {
      h.first.container.children = h.first.container.children.filter((child) => child !== h.first.composer);
      h.body.append(h.first.composer);
    }
    h.observe();
    h.release();
    assert.equal(h.latest(), null, ambiguity);
  }
});

test("popup waits for completed drag or keyboard selection and ignores its own events", () => {
  const h = harness();
  h.observe();
  h.documentEvents.emit("pointerdown", { target: h.first.assistant });
  h.documentEvents.emit("pointermove", { target: h.first.assistant });
  h.documentEvents.emit("selectionchange");
  assert.equal(h.changes.length, 0);
  h.release();
  assert.equal(h.latest()?.messageId, "first-message");
  const menu = h.body.append(new Element({ "data-testid": "quote-reply-selection-menu" }));
  const menuChild = menu.append(new Element());
  const count = h.changes.length;
  h.selection.isCollapsed = true;
  h.release(menuChild);
  h.documentEvents.emit("keyup", { target: menuChild });
  assert.equal(h.changes.length, count);
  h.release();
  assert.equal(h.latest(), null);
  h.selection.isCollapsed = false;
  h.documentEvents.emit("keyup", { target: h.first.assistant });
  assert.equal(h.latest()?.messageId, "first-message");
});

test("editable controls and reply dialogs cannot reopen a popup from an old page selection", () => {
  const h = harness();
  h.observe();
  h.release();
  const count = h.changes.length;
  for (const attrs of [
    { tag: "input" }, { tag: "textarea" },
    { contenteditable: "true" }, { role: "dialog" },
  ] as Array<Record<string, string>>) {
    const container = h.body.append(new Element(attrs));
    const target = container.append(new Element());
    // Browser page selection may survive focus changes into a text field.
    h.release(target);
    h.documentEvents.emit("keyup", { target });
    assert.equal(h.changes.length, count, JSON.stringify(attrs));
  }
});

test("row identity, assistant content and removed anchor invalidate captured selections", () => {
  for (const change of ["identity", "content", "anchor"]) {
    const h = harness();
    h.observe();
    h.release();
    const captured = h.latest()!;
    assert.equal(captured.isValid(), true);
    if (change === "identity") h.first.row.attributes["data-message-id"] = "recycled-row";
    else if (change === "content") h.first.assistant.textContent = "Changed response";
    else {
      h.first.button.children = [];
      h.first.marker.parentElement = null;
    }
    assert.equal(captured.isValid(), false, change);
    h.mutate();
    assert.equal(h.latest(), null, change);
  }
});

test("scroll, resize and cleanup clear observers and restore only the plugin button", () => {
  const h = harness();
  h.first.button.style.display = "inline-flex";
  const dispose = h.observe();
  h.release();
  h.windowEvents.emit("scroll");
  assert.equal(h.latest(), null);
  h.release();
  h.windowEvents.emit("resize");
  assert.equal(h.latest(), null);
  h.release();
  dispose();
  assert.equal(h.first.button.style.display, "inline-flex");
  assert.equal(h.first.unrelatedButton.style.display, "flex");
  assert.equal(h.documentEvents.listeners.size, 0);
  assert.equal(h.windowEvents.listeners.size, 0);
  assert.ok(h.observers.every((observer) => !observer.active));
});

test("missing marker or button fails without mutating other controls or registering listeners", () => {
  for (const missing of ["marker", "button"]) {
    const h = harness();
    if (missing === "marker") delete h.first.marker.attributes.id;
    else delete h.first.button.attributes.role;
    h.api.observeNativeMessageSelection("quote-reply-anchor-first", () => assert.fail("unexpected selection"))();
    assert.equal(h.first.button.style.display, "flex");
    assert.equal(h.documentEvents.listeners.size, 0);
    assert.equal(h.windowEvents.listeners.size, 0);
  }
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
  h.documentEvents.emit("keydown", { ...event, target: { id: "main-composer" } });
  h.documentEvents.emit("keydown", { ...event, shiftKey: true });
  h.documentEvents.emit("keydown", { ...event, isComposing: true });
  assert.deepEqual([sent, prevented, stopped], [0, 0, 0]);
  h.documentEvents.emit("keydown", event);
  assert.deepEqual([sent, prevented, stopped], [1, 1, 1]);
  dispose();
  assert.equal(h.documentEvents.listeners.size, 0);
});

test("native clients do not register browser listeners or hide controls", () => {
  const h = harness("ios");
  h.observe()();
  h.api.observeReplySubmitKey("reply-1", () => assert.fail("native send"))();
  assert.equal(h.first.button.style.display, "flex");
  assert.equal(h.documentEvents.listeners.size, 0);
  assert.equal(h.windowEvents.listeners.size, 0);
});
