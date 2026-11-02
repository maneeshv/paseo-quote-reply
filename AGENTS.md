# Repository instructions

This is a client-only Paseo plugin. Prefer the smallest complete change and reuse existing SDK operations and UI components.

## Structure and conventions

- `index.client.tsx`: screen registration and selection listener startup.
- `client/register-selection.tsx`: agent-scoped contributions, subscription reconciliation, and cleanup.
- `client/assistant-reply.tsx`, `client/reply-form.tsx`, `client/new-chat.tsx`: selection menu, forms, and creation state.
- `client/web.ts`: version-specific DOM adapter and keyboard handling.
- `shared/`: quote formatting and bounded history/configuration preparation.
- `tests/`: Node tests with synthetic history, SDK mocks, and DOM fixtures.

Use TypeScript and absolute `@/` project imports. Tests may use the package's `#quote` and `#fork` import aliases. Use npm with the committed lockfile; avoid adding dependencies for a few lines of code. Check Context7 when available and pinned SDK types/official documentation before relying on APIs.

Keep browser globals in `client/web.ts` and gate unsupported platforms. Never import Node or server runtime modules into client code. Keep React Native UI themed and accessible.

Do not replace native assistant timeline rows: this removes Paseo's native fork/copy controls. Preserve selection ownership checks, bounded history, stable checkpoints, explicit busy-agent behavior, duplicate prevention, uncertain-outcome handling, and cleanup. No automatic retry of sends or ambiguous creation failures.

Never commit credentials, account configuration, private conversations, personal paths, or dependency directories. Use `trash` for manual deletions. Use Conventional Commit messages.

## Verification

Run `npm ci --ignore-scripts`, `npm run typecheck`, and `npm test`. Add a meaningful regression test for non-trivial behavior. For runtime changes, verify compilation with the supported Paseo version and test the changed interaction in an authorized development installation.

For UI changes, check wide/compact layouts, theme colors, keyboard/IME handling, split panes, both reply actions, and native fork/copy controls. Automated DOM fixtures do not prove live desktop behavior. Reload only an authorized installation; reload loses in-memory drafts. Never restart the daemon as a shortcut.

Keep README.md, OVERVIEW.md, SECURITY.md, and VALIDATION.md accurate. Do not widen compatibility or claim live checks without evidence.
