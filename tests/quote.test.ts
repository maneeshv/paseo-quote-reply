import assert from "node:assert/strict";
import test from "node:test";
import { formatQuoteReply, isSelectionInside, shouldSendOnEnter } from "#quote";

test("prefixes every quote line, including blank lines", () => {
  assert.equal(formatQuoteReply("first\n\nsecond", "ok"), "> first\n> \n> second\n\nok");
});

test("normalizes CRLF and lone CR to LF", () => {
  assert.equal(formatQuoteReply("a\r\nb\rc", "done\r\n"), "> a\n> b\n> c\n\ndone");
});

test("trims only outer whitespace, keeping inner indentation", () => {
  assert.equal(formatQuoteReply("  padded\n  inner  \n", " reply "), "> padded\n>   inner\n\nreply");
});

test("rejects an empty quote or reply", () => {
  assert.equal(formatQuoteReply("", "hi"), null);
  assert.equal(formatQuoteReply("quote", "   \n"), null);
  assert.equal(formatQuoteReply("  \r\n ", "hi"), null);
});

test("enter sends only outside shift and IME composition", () => {
  assert.equal(shouldSendOnEnter({ key: "Enter", shiftKey: false }), true);
  assert.equal(shouldSendOnEnter({ key: "Enter", shiftKey: true }), false);
  assert.equal(shouldSendOnEnter({ key: "Enter", shiftKey: false, isComposing: true }), false);
  assert.equal(shouldSendOnEnter({ key: "Enter", shiftKey: false, keyCode: 229 }), false);
  assert.equal(shouldSendOnEnter({ key: "a", shiftKey: false }), false);
});

test("selection counts only when both endpoints are inside the message", () => {
  const inside = { inside: true };
  const outside = { inside: false };
  const container = {
    contains: (node: unknown) => (node as { inside?: boolean } | null)?.inside === true,
  };
  assert.equal(isSelectionInside(container, inside, inside), true);
  assert.equal(isSelectionInside(container, inside, outside), false);
  assert.equal(isSelectionInside(container, outside, inside), false);
  assert.equal(isSelectionInside(container, null, inside), false);
  assert.equal(isSelectionInside(container, inside, null), false);
});
