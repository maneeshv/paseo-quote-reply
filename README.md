# Quote reply for Paseo

Select text in a completed assistant message and press **Reply**, or use the permanent **Reply** button beneath the message. Edit the quote, write your reply, and send it into the same conversation.

- Desktop/web: Enter sends; Shift+Enter adds a newline. IME composition does not send.
- Mobile: the whole-message button opens a sheet; submit with **Send reply**.
- Running agent: **Send & steer** asks Paseo to steer. Paseo may restart the turn if steering is unavailable.
- Failed sends keep the draft. Check the chat before retrying an uncertain send.
- Drafts are local to the mounted message and do not survive navigation or reload.

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

Automated checks cover multiline blockquotes, newline normalization, empty input, IME/Shift+Enter handling, and cross-message selection rejection. Paseo's installed 0.14.0 compiler also builds the client successfully with no server bundle.

The selection-and-reply workflow has been confirmed by the user in Paseo 0.14.0. Further live checks: drag-select and open Reply, inspect exact quote and focus, use Shift+Enter and Enter, confirm the message lands only in the intended chat, exercise a rejected send, and inspect compact and dark layouts.
