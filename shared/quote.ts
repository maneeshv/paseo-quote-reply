// Pure reply-composition helpers. No DOM lib and no React Native imports so
// node:test can run against this module directly.

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * Builds the outgoing message: every quote line prefixed with "> " (blank
 * lines too), a blank line, then the reply. CRLF is normalized and only outer
 * whitespace is trimmed. Returns null when either side is empty.
 */
export function formatQuoteReply(quote: string, reply: string): string | null {
  const trimmedQuote = normalizeNewlines(quote).trim();
  const trimmedReply = normalizeNewlines(reply).trim();
  if (!trimmedQuote || !trimmedReply) return null;
  const quoted = trimmedQuote
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${quoted}\n\n${trimmedReply}`;
}

export interface ReplyKeyEvent {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

/**
 * Enter sends; Shift+Enter inserts a newline. An Enter during IME composition
 * (isComposing, or legacy keyCode 229) must never send.
 */
export function shouldSendOnEnter(event: ReplyKeyEvent): boolean {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    event.isComposing !== true &&
    event.keyCode !== 229
  );
}

export interface SelectionContainer {
  contains(node: unknown): boolean;
}

/** Both selection endpoints must sit inside this message's own content element. */
export function isSelectionInside(
  container: SelectionContainer,
  anchorNode: unknown,
  focusNode: unknown,
): boolean {
  return (
    anchorNode != null &&
    focusNode != null &&
    container.contains(anchorNode) &&
    container.contains(focusNode)
  );
}
