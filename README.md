# Quote reply for Paseo

Select text in a completed assistant message and press **Reply**, or use the permanent **Reply** button beneath the message. Edit the quote, write your reply, and send it into the same conversation. **Reply in new chat** opens a separate reply form and creates a new chat when you submit, then opens that chat.

- Desktop/web: Enter sends; Shift+Enter adds a newline. IME composition does not send.
- Mobile: the whole-message button opens a sheet; submit with **Send reply**.
- Running agent: **Send & steer** asks Paseo to steer. Paseo may restart the turn if steering is unavailable.
- Failed sends keep the draft. Check the chat before retrying an uncertain send.
- Drafts stay in memory and do not survive navigation or reload. Quote text is not put in screen URLs.
- New-chat replies carry user/assistant messages and concise tool summaries and received agent messages up to the chosen response as a text attachment, capped at 100,000 characters with explicit omission markers. Later messages are excluded.
- The new chat shares the workspace and copies the visible provider/model/mode/thinking/features. It omits subagent logs and does not clone hidden provider state, custom system prompts, tool policies, or per-agent MCP configuration. Files in the workspace remain shared.
- Messages without a stable message ID do not offer new-chat replies. Incomplete or changed history blocks creation.
- An uncertain creation failure keeps the draft and blocks another submission from that form; check the chat list. A navigation failure offers **Open chat** without creating another agent.

Paseo **0.14.x** is required. This is a client-only plugin; it uses the current host connection and does not add an external service. Assistant text selection is scoped to the plugin's own message view. Streaming messages keep Paseo's default renderer.

## Development

Use Node 22.18+ for the tests' native TypeScript support.

```sh
npm ci
npm run typecheck
npm test
```

After enabling trusted plugins in Paseo Settings, install this directory:

```sh
paseo plugin install /absolute/path/to/paseo-quote-reply
paseo plugin ls quote-reply
```

After editing, typecheck and use `paseo plugin reload quote-reply`. No daemon restart is needed. Disable it with `paseo plugin disable quote-reply` to restore the built-in assistant message rendering.

## Verification

Automated checks cover multiline blockquotes, newline normalization, empty input, IME/Shift+Enter handling, cross-message selection rejection, fork-history boundaries and truncation, incomplete history, configuration copying, creation failures, duplicate submissions across remounts, navigation retries, and URL privacy (24 tests). Paseo's installed 0.14.0 compiler also builds the client successfully with no server bundle.

An isolated live fork test created a new agent that recalled the earlier assistant text from the history attachment, preserved model/mode/workspace, and left the source chat unchanged.

The selection-and-reply workflow has been confirmed by the user in Paseo 0.14.0. The new-chat buttons and screen have not yet been click-tested in the desktop app. Further live checks: drag-select and open Reply, inspect exact quote and focus, use Shift+Enter and Enter, confirm the message lands only in the intended chat, exercise a rejected send, and inspect compact and dark layouts.
