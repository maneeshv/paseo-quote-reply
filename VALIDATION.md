# Validation

## Open-source preparation checks

Checked on 2026-11-02 on macOS, against unchanged runtime source from commit `9c6351d`:

- Copied tracked source and publication files into a clean temporary directory without `node_modules` or local configuration.
- `npm ci --ignore-scripts` installed the committed dependency tree successfully. Typechecking and all 37 tests passed with Node.js 22.18.0, the documented minimum. The regular typecheck and test commands also passed with the local Node.js 25.6.1 installation.
- Paseo 0.14.0's installed plugin compiler built that clean copy after dependency installation: client bundle present, no server bundle. A source-only compile without dependencies could not resolve type imports, so the README explicitly requires dependency installation first.
- Re-ran an isolated probe of the installed Paseo projection and fork resolver. Replacing assistant rows reproduces the missing native fork boundary; preserving native rows retains it. This probe is specific to the installed bundle and is not part of portable CI.
- Reviewed all three existing Git commits for credentials, private paths, and private conversation data. No such publication blocker was found. This review is not a proof that every possible secret pattern is absent.
- `npm audit` reported 12 moderate development dependency findings, no high or critical findings. See [SECURITY.md](SECURITY.md).

The publication change updates documentation and package metadata only. It does not change runtime behavior or dependencies, reload the user's plugin, or send test messages.

## Automated coverage

Tests cover quote formatting, Enter/Shift+Enter/IME handling, split-pane ownership, ambiguous selections, stale DOM rows, popup cleanup, native-row preservation, registration pagination/reconnect/cleanup, stable fork boundaries, history truncation, configuration copying, and duplicate prevention across remounts.

The [CI template](docs/ci.yml.example) is inactive because the publishing token lacks workflow write permission. These checks were run locally; no passing GitHub Actions CI run is claimed.

## Earlier development evidence

The development session recorded a live new-chat test that verified attached context, model/mode/workspace preservation, and unchanged source history. After the native-row correction, live agent registration and cleanup passed and Paseo reported the plugin running without load errors. Those live checks were not repeated for this documentation change.

The original reply experience was confirmed by the user before the selection-only correction. That does not establish live behavior for every interaction in the current UI.

## Manual checks still needed

The corrected selection-only desktop interface still needs a full click-through check: outside-click dismissal, both reply actions, native fork/copy controls, split panes, compact layouts, and light/dark themes. Automated fixtures and the native fork resolver probe do not replace these checks. Windows/Linux clients have not been manually validated; native mobile and archived chats intentionally have no popup.
