# Contributing

Small, focused issues and pull requests are welcome. For larger changes, open an issue describing the user problem first. Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Local development

Fork and clone the repository. Use Node.js 22.18+ (`nvm use` reads `.nvmrc`), then run:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

Tests use synthetic history, mocked SDK operations, and DOM fixtures. They need no running Paseo daemon or provider account. Host SDK packages are development dependencies because Paseo supplies runtime modules. `private: true` prevents accidental npm publication; it does not make the GitHub repository private.

For manual checks, install the local directory on a trusted development daemon with `paseo plugin install "$PWD" --id quote-reply`, then use `paseo plugin reload quote-reply` after source changes. Do not install duplicate copies: they can show overlapping selection menus. Reloading loses in-memory drafts. Do not restart the daemon.

## Before submitting

- Run typecheck and tests. Add meaningful regression coverage for behavioral changes.
- Explain the problem, changed behavior, and verification. Use Conventional Commit titles such as `fix: dismiss stale selections`.
- Keep native assistant rows and fork/copy controls intact. Test both reply actions, split panes, uncertain sends, and navigation races when relevant.
- For UI changes, check wide and compact desktop layouts, keyboard/IME input, and light/dark themes. Remove private content from screenshots.
- Keep README, OVERVIEW, VALIDATION, and the manifest compatibility range accurate. Do not broaden Paseo support based only on a typecheck.
- Follow [AGENTS.md](AGENTS.md) for imports, runtime boundaries, and cleanup.

Never include credentials, account configuration, private transcripts, or machine-specific paths. Report security issues privately as described in [SECURITY.md](SECURITY.md).

Contributions are licensed under the repository's MIT License. No separate contributor agreement is required.

## Optional GitHub Actions setup

[docs/ci.yml.example](docs/ci.yml.example) runs the same install, typecheck, and tests with read-only repository permissions. It is a template, not an active workflow. The publishing GitHub token lacks the `workflow` scope, so local checks remain the verification path.

A maintainer with workflow write access can copy it to `.github/workflows/ci.yml`, commit, and push. No additional token permissions are needed to run the local checks.
