import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { formatQuoteReply } from "#quote";

const compiled = ts.transpileModule(
  readFileSync(new URL("../client/new-chat.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

type Element = { type: string | ((props: any) => Element); props: any; key?: string };

// Exercise the screen's submission flow without native rendering. State is
// retained on rerender and discarded on remount; its module draft survives.
function harness() {
  let states: unknown[] = [];
  let cleanups: Array<() => void> = [];
  let cursor = 0;
  let params: Record<string, string> = {};
  let activeKey: string | undefined;
  let createCalls = 0;
  let rejectCreate!: (error: Error) => void;
  let resolveCreate!: (id: string) => void;
  const created = new Promise<string>((resolve, reject) => {
    resolveCreate = resolve;
    rejectCreate = reject;
  });
  const navigations: unknown[] = [];
  let navigationFails = false;
  const api = {} as {
    openNewChatReply(open: (input: { params: Record<string, string> }) => void, draft: unknown): void;
    NewChatReplyScreen(props: unknown): Element;
  };
  const jsx = (type: Element["type"], props: any, key?: string): Element => ({ type, props, key });
  const react = {
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    useState(initial: unknown) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = initial;
      const owner = states;
      return [states[slot], (value: unknown) => { owner[slot] = value; }];
    },
    useRef(initial: unknown) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = { current: initial };
      return states[slot];
    },
    useEffect(effect: () => void | (() => void)) {
      const slot = cursor++;
      if (slot in states) return;
      states[slot] = true;
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
  };
  runInNewContext(compiled, {
    exports: api,
    require(name: string) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react-native") return { ScrollView: "ScrollView", Text: "Text" };
      if (name === "@getpaseo/plugin/client") return { usePaseo: () => ({}) };
      if (name === "@/client/reply-form") return { ReplyForm: "ReplyForm" };
      if (name === "@/shared/quote") return { formatQuoteReply };
      if (name === "@/shared/fork") return {
        ForkPreparationError: class extends Error {},
        createReplyChat: () => { createCalls++; return created; },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const navigation = { openAgent(input: unknown) {
    navigations.push(input);
    if (navigationFails) throw new Error("navigation failed");
  } };
  function open(quote = "Private quote") {
    api.openNewChatReply((input) => { params = input.params; }, {
      agentId: "source", messageId: "checkpoint", quote,
    });
    return params;
  }
  function render(remount = false) {
    const root = api.NewChatReplyScreen({
      params, theme: { colors: {} }, layout: { compact: false }, navigation,
    });
    const child = root.props.children as Element;
    assert.equal(typeof child.type, "function");
    if (remount || activeKey !== child.key) unmount();
    activeKey = child.key;
    cursor = 0;
    return (child.type as (props: unknown) => Element)(child.props).props;
  }
  function unmount() {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    states = [];
  }
  return {
    open, render, unmount, resolveCreate, rejectCreate, navigations,
    createCalls: () => createCalls,
    failNavigation(value: boolean) { navigationFails = value; },
  };
}

async function settle() {
  // Submit intentionally returns void; allow its async continuation to finish.
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

test("new-chat URLs contain only an opaque key and replacing drafts resets the form", () => {
  const h = harness();
  const params = h.open("Private quote");
  assert.deepEqual(Object.keys(params), ["draft"]);
  assert.doesNotMatch(JSON.stringify(params), /Private|source|checkpoint/);
  h.render().onReplyChange("Old reply");
  assert.equal(h.render().reply, "Old reply");
  h.open("Next quote");
  assert.equal(h.render().quote, "Next quote");
  assert.equal(h.render().reply, "");
});

test("pending creation is single-shot across duplicate events and a screen remount", async () => {
  const h = harness();
  h.open();
  h.render().onReplyChange("Reply");
  const form = h.render();
  form.onSubmit();
  form.onSubmit();
  const remounted = h.render(true);
  assert.equal(remounted.pending, true);
  remounted.onSubmit();
  assert.equal(h.createCalls(), 1);
  h.resolveCreate("created");
  await settle();
  assert.equal(h.render().sendLabel, "Open chat");
});

test("uncertain creation stays blocked after remount", async () => {
  const h = harness();
  h.open();
  h.render().onReplyChange("Reply");
  h.render().onSubmit();
  h.rejectCreate(new Error("lost acknowledgement"));
  await settle();
  const form = h.render(true);
  assert.equal(form.sendDisabled, true);
  assert.match(form.error, /may or may not have succeeded/);
  form.onSubmit();
  assert.equal(h.createCalls(), 1);
  assert.equal(h.navigations.length, 0);
});

test("navigation failure retries opening the created chat without creating another", async () => {
  const h = harness();
  h.open();
  h.render().onReplyChange("Reply");
  h.failNavigation(true);
  h.render().onSubmit();
  h.resolveCreate("created");
  await settle();
  assert.match(h.render().error, /created but could not be opened/);
  h.failNavigation(false);
  const form = h.render(true);
  assert.equal(form.sendLabel, "Open chat");
  form.onSubmit();
  assert.equal(h.createCalls(), 1);
  assert.equal(JSON.stringify(h.navigations), '[{"agentId":"created"},{"agentId":"created"}]');
});

test("completion after leaving the form does not navigate and remains recoverable", async () => {
  const h = harness();
  h.open();
  h.render().onReplyChange("Reply");
  h.render().onSubmit();
  h.unmount();
  h.resolveCreate("created");
  await settle();
  assert.equal(h.navigations.length, 0);
  const form = h.render(true);
  assert.equal(form.sendLabel, "Open chat");
  form.onSubmit();
  assert.equal(h.createCalls(), 1);
  assert.equal(h.navigations.length, 1);
});

test("completion of a replaced draft cannot redirect or alter the new draft", async () => {
  const h = harness();
  h.open();
  h.render().onReplyChange("Reply");
  h.render().onSubmit();
  h.open("New quote");
  h.resolveCreate("created");
  await settle();
  assert.equal(h.navigations.length, 0);
  const form = h.render();
  assert.equal(form.quote, "New quote");
  assert.equal(form.sendLabel, "Create chat");
  assert.equal(form.sendDisabled, false);
});
