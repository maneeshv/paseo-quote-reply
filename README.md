# Quote reply for Paseo

Select text in an assistant message and choose **Reply** or **New chat** from a floating menu. Edit the quote, add your reply, and send it to the same conversation or a new chat with earlier context.

This is a community plugin, not an official Paseo product. It preserves Paseo's native message rendering, copy controls, and **Fork chat from here** menu. There are no permanent reply buttons beneath messages.

## Requirements

| Component | Compatibility |
| --- | --- |
| Paseo app and daemon | Exactly 0.14.0 or 0.15.0; manifest range `>=0.14.0 <0.15.1` |
| Client | Desktop/web with browser text selection; local checks used macOS |
| Development | Node.js 22.18+ and npm; `.nvmrc` and lockfile included |

Native mobile and archived chats do not receive the popup. The version-specific DOM adapter rejects ambiguous pane ownership and may leave some blank composer-track space. Other Paseo versions require an adapter review before widening compatibility. See [validation](VALIDATION.md) for what has and has not been tested.

## Install

Paseo plugins are trusted, unsandboxed code. Review the source before enabling plugins in **Settings → Plugins**, and only use a daemon you trust.

Run these commands on the daemon host:

```sh
git clone https://github.com/maneeshv/paseo-quote-reply.git
cd paseo-quote-reply
npm ci --ignore-scripts
npm run typecheck
npm test
paseo plugin install "$PWD" --id quote-reply
paseo plugin ls quote-reply
```

Keep the cloned directory in place: Paseo loads this local path. Run `npm ci --ignore-scripts` before installation: Paseo needs the local dependency tree to resolve type imports during compilation. Paseo supplies the runtime modules. Distribution is through GitHub, not npm or the Paseo registry.

## Use

1. Drag to select text within one assistant message and release the mouse.
2. Choose **Reply** for the same agent or **New chat** for a new conversation.
3. Edit the quote, enter your reply, and submit. Enter sends; Shift+Enter adds a newline. IME composition does not send.

For a running agent, **Send & steer** requests steering; Paseo may restart the turn if steering is unavailable. Failed sends keep the draft. If the outcome is uncertain, check the chat before retrying.

**New chat** includes messages and concise tool summaries through the selected response as a text attachment, capped at 100,000 characters with omission markers. It shares the source workspace files and copies visible provider/model/mode/thinking/features. It does not clone hidden session state, custom system prompts, tool policies, per-agent MCP configuration, or subagent logs. The source conversation stays unchanged.

Incomplete history or a missing stable checkpoint blocks creation. An uncertain creation failure blocks resubmission from that form; check the workspace before starting another. If creation succeeds but navigation fails, **Open chat** retries navigation without creating another agent.

## Data and permissions

The client observes agent metadata to scope the popup to the correct chat. Reply sends the quote and your text through the current Paseo host to the configured agent provider. New chat also reads the source timeline and includes the bounded history attachment in the new agent's prompt. Normal provider permissions, usage costs, and retention policies apply.

This plugin adds no backend process, telemetry endpoint, or separate external service. That does not mean submitted conversations stay on your machine. Drafts are held in memory and are not durable across navigation or reload; quote text is not placed in screen URLs. Do not submit information you cannot share with the configured provider.

## Updates and troubleshooting

After pulling changes, rerun the installation checks above, then reload:

```sh
paseo plugin reload quote-reply
```

No daemon restart is needed. To disable the popup:

```sh
paseo plugin disable quote-reply
```

- **No popup:** check both Paseo versions, global plugin enablement, and `paseo plugin ls quote-reply`. Select within one assistant message in a non-archived chat. Ambiguous or stale selections are rejected.
- **New chat unavailable:** let the source history settle and select the response again. Creation requires a stable message checkpoint and complete projected history.
- **Uncertain submission:** check the conversation or workspace chat list before trying again; the plugin does not automatically retry sends.
- **Load failure:** inspect `paseo plugin logs quote-reply`. Redact private paths, prompts, and credentials before sharing diagnostics.

## Contribute and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

Licensed under the [MIT License](LICENSE).
