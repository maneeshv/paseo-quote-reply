# Quote reply for Paseo

Select text inside a native assistant message, release the mouse, and choose **Reply** or **New chat** in the floating menu. There are no permanent reply buttons beneath messages. Paseo keeps its own message renderer, copy controls, and **Fork chat from here** menu.

- Desktop/web: edit the quote, enter your reply, then Enter sends; Shift+Enter adds a newline. IME composition does not send.
- Running agent: **Send & steer** asks Paseo to steer. Paseo may restart the turn if steering is unavailable.
- Failed sends keep the draft. Check the chat before retrying an uncertain send.
- Drafts stay in memory and do not survive navigation or reload. Quote text is not put in screen URLs.
- **New chat** carries messages and concise tool summaries through the chosen response as a text attachment, capped at 100,000 characters with omission markers. It shares workspace files and copies visible provider/model/mode/thinking/features. It omits subagent logs and hidden session state, custom system prompts, tool policies, and per-agent MCP configuration.
- Incomplete history or a message without a matching stable checkpoint blocks new-chat creation. An uncertain creation failure blocks resubmission from that form. A navigation failure offers **Open chat** without creating another agent.

Requires Paseo **0.14.0** desktop/web. Native mobile and archived chats do not get the selection popup. This is a client-only plugin using the current host connection, with no external service.

The popup uses an invisible, agent-scoped composer contribution as its anchor. It only observes the matching pane's native assistant messages, rejects cross-message/ambiguous selections, and rechecks ownership at activation. Only the plugin's own button is hidden; native controls are untouched. Paseo may reserve blank composer-track space for this contribution. The DOM adapter is version-pinned and fails closed if the expected pane structure is unavailable.

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

After editing, typecheck and use `paseo plugin reload quote-reply`. No daemon restart is needed. Disable it with `paseo plugin disable quote-reply` to remove the selection popup; native message rendering is always preserved.

## Verification

Automated tests cover quote formatting, IME/Enter handling, split-pane selection ownership, ambiguous scopes, stale DOM rows, popup cleanup, native-row preservation, registration lifecycle, fork boundaries, history truncation, configuration copying, and duplicate prevention across remounts.

An isolated check against Paseo 0.14.0's actual bundled projection and fork resolver reproduces the previous replacement-row regression and verifies that preserving native assistant rows restores their fork boundary. The installed compiler builds the client with no server bundle.

The earlier live fork test verified attached context, model/mode/workspace preservation, and unchanged source history. The corrected selection-only UI still needs desktop click-through verification, including outside-click dismissal, both reply actions, native fork/copy controls, split panes, and compact/dark layouts.
