import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import type { PluginClientContext, PluginComposerPillContribution } from "@getpaseo/plugin/client";
import type { PaseoAgentListResult } from "@getpaseo/client";

// Node's native TS loader does not load TSX; compile the two entry modules using
// the installed compiler and mock only their UI imports (no DOM or daemon sends).
function load(file: string, imports: Record<string, unknown> = {}) {
  const source = readFileSync(resolve(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", output)((name: string) => {
    assert.ok(name in imports, `Unexpected runtime import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}
const { registerSelectionReplies } = load("client/register-selection.tsx") as
  typeof import("@/client/register-selection");
type Observer = Parameters<NonNullable<PaseoAgentListResult["subscription"]>["subscribe"]>[0];
const tick = () => new Promise<void>((done) => setImmediate(done));
const agent = (id: string, workspaceId = "workspace") => ({ id, workspaceId, archivedAt: null });
function page(ids: string[], more: string | null = null) {
  return { entries: ids.map((id) => ({ agent: agent(id) })), pageInfo: { hasMore: !!more, nextCursor: more, prevCursor: null } } as PaseoAgentListResult;
}
function fixture(first = page(["one"])) {
  let observer: Observer | undefined;
  let released = 0;
  let stopped = 0;
  const added: PluginComposerPillContribution[] = [];
  const removed: string[] = [];
  const requests: unknown[] = [];
  const subscription = {
    subscribe(value: Observer) { observer = value; value.snapshot({ ...first, subscriptionId: "subscription" }); return () => { stopped++; }; },
    async release() { released++; },
  };
  const client = {
    paseo: { agents: { async list(options: unknown) { requests.push(options); return { ...first, subscription }; } } },
    addComposerPill(pill: PluginComposerPillContribution) {
      added.push(pill);
      return { remove() { removed.push(pill.agentId); }, update() {} };
    },
  };
  return { client, added, removed, requests, subscription, get observer() { return observer!; }, get released() { return released; }, get stopped() { return stopped; } };
}

test("entry registers its screen and web listener without replacing any native rows", () => {
  for (const platform of ["web", "ios"]) {
    let screens = 0, screenRemovals = 0, listeners = 0, listenerRemovals = 0;
    const entry = load("index.client.tsx", {
      "react-native": { Platform: { OS: platform } },
      "react/jsx-runtime": { jsx() {} },
      "@/client/assistant-reply": { SelectionReply() {} },
      "@/client/new-chat": { NEW_CHAT_SCREEN_ID: "new-chat-reply", NewChatReplyScreen() {}, openNewChatReply() {} },
      "@/client/register-selection": { registerSelectionReplies() { listeners++; return () => { listenerRemovals++; }; } },
    });
    const contribute = entry.default as (client: unknown) => () => void;
    const cleanup = contribute({ addScreen() { screens++; return () => { screenRemovals++; }; } });
    assert.equal(screens, 1);
    assert.equal(listeners, platform === "web" ? 1 : 0);
    cleanup();
    assert.equal(screenRemovals, 1);
    assert.equal(listenerRemovals, listeners);
  }
});

test("owned subscription mounts existing and new agents without remounting on status updates", async () => {
  const f = fixture();
  const cleanup = registerSelectionReplies(f.client as unknown as PluginClientContext, "Quote");
  await tick();
  assert.deepEqual(f.added.map((p) => p.agentId), ["one"]);
  f.observer.update({ type: "agent_update", payload: { kind: "upsert", agent: agent("one") } } as never);
  assert.equal(f.added.length, 1);
  f.observer.update({ type: "agent_update", payload: { kind: "upsert", agent: agent("two") } } as never);
  f.observer.update({ type: "agent_update", payload: { kind: "upsert", agent: agent("one", "moved") } } as never);
  assert.deepEqual(f.added.map((p) => [p.agentId, p.workspaceId]), [["one", "workspace"], ["two", "workspace"], ["one", "moved"]]);
  f.observer.update({ type: "agent_update", payload: { kind: "remove", agentId: "two" } } as never);
  cleanup(); cleanup();
  assert.deepEqual(f.removed, ["one", "two", "one"]);
  assert.equal(f.released, 1);
  assert.equal(f.stopped, 1);
});

test("pagination cannot resurrect a concurrently removed agent; reconnect removes absent agents", async () => {
  const f = fixture(page(["one"], "next"));
  let resolvePage!: (value: PaseoAgentListResult) => void;
  f.client.paseo.agents.list = async (options: unknown) => {
    f.requests.push(options);
    return f.requests.length === 1 ? { ...page(["one"], "next"), subscription: f.subscription }
      : await new Promise<PaseoAgentListResult>((done) => { resolvePage = done; }) as never;
  };
  const cleanup = registerSelectionReplies(f.client as unknown as PluginClientContext, "Quote");
  await tick();
  f.observer.update({ type: "agent_update", payload: { kind: "remove", agentId: "deleted" } } as never);
  resolvePage(page(["two", "deleted"]));
  await tick();
  assert.deepEqual(f.added.map((p) => p.agentId), ["one", "two"]);
  assert.equal(f.requests.length, 2);
  for (const request of f.requests) assert.equal((request as { includeBackground?: boolean }).includeBackground, true);
  f.observer.snapshot({ ...page(["two"]), subscriptionId: "reconnected" });
  await tick();
  assert.deepEqual(f.removed, ["one"]);
  assert.equal(f.added.length, 2);
  cleanup();
});

test("cleanup before bootstrap releases late observation without mounting pills", async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.client.paseo.agents.list = () => new Promise((done) => { finish = done; }) as never;
  const cleanup = registerSelectionReplies(f.client as unknown as PluginClientContext, "Quote");
  cleanup();
  finish({ subscription: f.subscription });
  await tick();
  assert.equal(f.added.length, 0);
  assert.equal(f.released, 1);
});

test("bootstrap rejection is reported without an unhandled rejection", async () => {
  const f = fixture();
  f.client.paseo.agents.list = async () => { throw Error("offline"); };
  const original = console.error;
  const reports: unknown[][] = [];
  console.error = (...args) => { reports.push(args); };
  try {
    const cleanup = registerSelectionReplies(f.client as unknown as PluginClientContext, "Quote");
    await tick();
    assert.equal(reports.length, 1);
    assert.match(String(reports[0]![0]), /Quote Reply: agent observation failed/);
    cleanup();
  } finally { console.error = original; }
});


test("cleanup during pagination ignores the remaining page", async () => {
  const f = fixture(page(["one"], "next"));
  let finish!: (value: PaseoAgentListResult) => void;
  f.client.paseo.agents.list = async (options: unknown) => {
    f.requests.push(options);
    return f.requests.length === 1 ? { ...page(["one"], "next"), subscription: f.subscription }
      : await new Promise<PaseoAgentListResult>((done) => { finish = done; }) as never;
  };
  const cleanup = registerSelectionReplies(f.client as unknown as PluginClientContext, "Quote");
  await tick();
  cleanup();
  finish(page(["two"]));
  await tick();
  assert.deepEqual(f.added.map((pill) => pill.agentId), ["one"]);
  assert.deepEqual(f.removed, ["one"]);
});
