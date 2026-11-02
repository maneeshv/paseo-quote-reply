import assert from "node:assert/strict";
import test from "node:test";
import type { PaseoApi, PaseoWorkspaceAgentCreateOptions } from "@getpaseo/client";
import { buildForkHistory, createReplyChat, ForkPreparationError, type ForkHistory } from "#fork";

function history(): ForkHistory {
  return {
    error: null, epoch: "epoch", projection: "projected", reset: false, staleCursor: false, gap: false, hasOlder: false, hasNewer: false,
    entries: [
      { seqStart: 1, seqEnd: 1, item: { type: "user_message", text: "Before" } },
      { seqStart: 2, seqEnd: 2, item: { type: "assistant_message", text: "Answer", messageId: "target" } },
      { seqStart: 3, seqEnd: 3, item: { type: "user_message", text: "AFTER TARGET" } },
    ],
  };
}

test("history stops at the last matching assistant checkpoint and leaves source untouched", () => {
  const page = history();
  const original = structuredClone(page);
  const text = buildForkHistory(page, "target");
  assert.match(text, /\[User\] Before/);
  assert.match(text, /\[Assistant\] Answer/);
  assert.doesNotMatch(text, /AFTER TARGET/);
  assert.deepEqual(page, original);
  page.entries.push({ seqStart: 4, seqEnd: 4, item: { type: "assistant_message", text: "Second version", messageId: "target" } });
  assert.match(buildForkHistory(page, "target"), /Second version/);
});

test("rejects unavailable, partial, stale and overlapping history", () => {
  for (const key of ["reset", "staleCursor", "gap", "hasOlder", "hasNewer"] as const) {
    assert.throws(() => buildForkHistory({ ...history(), [key]: true }, "target"));
  }
  assert.throws(() => buildForkHistory({ ...history(), error: "disconnected" }, "target"));
  assert.throws(() => buildForkHistory({ ...history(), projection: "canonical" }, "target"));
  assert.throws(() => buildForkHistory(history(), "missing"));
  assert.throws(() => buildForkHistory(history(), ""));
  const page = history();
  page.entries.push({ seqStart: 1, seqEnd: 3, item: { type: "assistant_message", text: "Merged", messageId: "other" } });
  assert.throws(() => buildForkHistory(page, "target"), /checkpoint changed/);
});

test("bounded history reports omissions and keeps the selected response", () => {
  const page = history();
  page.entries[0]!.item = { type: "user_message", text: "OLD".repeat(40_000) };
  const text = buildForkHistory(page, "target");
  assert.ok(text.length <= 100_000);
  assert.match(text, /Earlier chat history omitted/);
  assert.match(text, /\[Assistant\] Answer/);
  page.entries[1]!.item = { type: "assistant_message", text: "HEAD" + "x".repeat(110_000) + "TAIL", messageId: "target" };
  const oversized = buildForkHistory(page, "target");
  assert.ok(oversized.length <= 100_000);
  assert.match(oversized, /HEAD/);
  assert.match(oversized, /TAIL/);
  assert.match(oversized, /Message truncated/);
});

test("tool history uses display summaries, not raw external tool inputs or outputs", () => {
  const page = history();
  page.entries.unshift({ seqStart: 0, seqEnd: 0, item: {
    type: "tool_call", name: "Read file", status: "completed", callId: "tool",
    detail: { type: "unknown", input: { secret: "RAW INPUT" }, output: "RAW OUTPUT" },
  } as ForkHistory["entries"][number]["item"] });
  const text = buildForkHistory(page, "target");
  assert.match(text, /\[Read file\]/);
  assert.doesNotMatch(text, /RAW INPUT|RAW OUTPUT/);
});


test("preserves typed agent-message instructions with sender summary", () => {
  const page = history();
  page.entries.unshift({ seqStart: 0, seqEnd: 0, item: {
    type: "tool_call", callId: "received", name: "agent_message", status: "completed", error: null,
    agentMessage: { event: "message", sender: { id: "parent-agent", title: "Original task" }, text: "  Preserve the original task instructions.  " },
    detail: { type: "unknown", input: { hidden: "RAW INPUT" }, output: "RAW OUTPUT" },
  } });
  const text = buildForkHistory(page, "target");
  assert.match(text, /\[Message received\] Original task/);
  assert.match(text, /Preserve the original task instructions\./);
  assert.doesNotMatch(text, /RAW INPUT|RAW OUTPUT/);
});

test("includes bounded canonical tool summaries without file contents", () => {
  const page = history();
  page.entries.unshift({ seqStart: 0, seqEnd: 0, item: {
    type: "tool_call", callId: "read", name: "read_file", status: "completed", error: null,
    detail: { type: "read", filePath: "/project/" + "a".repeat(250), content: "PRIVATE FILE CONTENT" },
  } });
  const text = buildForkHistory(page, "target");
  assert.match(text, /\[Read\] \/project\//);
  assert.match(text, /\.\.\./);
  assert.doesNotMatch(text, /PRIVATE FILE CONTENT/);
});

function fixture() {
  const source = {
    id: "source", workspaceId: "workspace", provider: "codex", model: "gpt-model", currentModeId: "read-only",
    thinkingOptionId: "high", features: [{ id: "fast", value: true }], runtimeInfo: {},
  };
  const page = { ...history(), agent: source };
  const calls: PaseoWorkspaceAgentCreateOptions[] = [];
  let failure: Error | null = null;
  const paseo = {
    agents: { ref(id: string) {
      assert.equal(id, "source");
      return { timeline: { async refetch(options: unknown) {
        assert.deepEqual(options, { direction: "tail", limit: 0, projection: "projected" });
        return page;
      } } };
    } },
    workspaces: { ref(id: string) {
      assert.equal(id, "workspace");
      return { agents: { async create(options: PaseoWorkspaceAgentCreateOptions) {
        calls.push(options);
        if (failure) throw failure;
        return { id: "created" };
      } } };
    } },
  } as unknown as PaseoApi;
  return { paseo, page, source, calls, fail(error: Error) { failure = error; } };
}

test("creates once in the same workspace with visible settings and prompt; does not mutate source", async () => {
  const f = fixture();
  const original = structuredClone(f.source);
  assert.equal(await createReplyChat(f.paseo, "source", "target", "> Answer\n\nWhy?"), "created");
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0]!.config, {
    provider: "codex/gpt-model", modeId: "read-only", thinkingOptionId: "high", featureValues: { fast: true },
  });
  assert.equal(f.calls[0]!.prompt, "> Answer\n\nWhy?");
  assert.equal(f.calls[0]!.attachments?.[0]?.type, "text");
  assert.equal(f.calls[0]!.parent, undefined);
  assert.deepEqual(f.source, original);
});

test("preparation failures create nothing; optional mode can use provider default", async () => {
  const f = fixture();
  f.source.model = "";
  await assert.rejects(createReplyChat(f.paseo, "source", "target", "Reply"), ForkPreparationError);
  assert.equal(f.calls.length, 0);
  f.source.model = "gpt-model";
  f.source.currentModeId = "";
  await createReplyChat(f.paseo, "source", "target", "Reply");
  assert.equal(f.calls[0]!.config.modeId, undefined);
});

test("uncertain creation errors propagate without retry or preparation-error wrapping", async () => {
  const f = fixture();
  const failure = new Error("connection lost after creation");
  f.fail(failure);
  await assert.rejects(createReplyChat(f.paseo, "source", "target", "Reply"), (error) => error === failure);
  assert.equal(f.calls.length, 1);
});
