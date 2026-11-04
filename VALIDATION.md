# Validation

## Paseo 0.15.0 compatibility

Checked on 2026-11-04 on macOS with Paseo 0.15.0 (app and daemon) and Node.js 25.6.1. The manifest range is `>=0.14.0 <0.15.1`. It covers only the two releases whose DOM adapter has been reviewed. Patch releases are not included until reviewed.

- SDK: `@getpaseo/plugin` and `@getpaseo/protocol` are pinned to 0.15.0. The `@getpaseo/plugin` client declarations and runtime are identical to 0.14.0. The only changes are server-side. In the protocol and client types this plugin uses, the only change is that `sub_agent` timeline details now have an optional `log` field, which this plugin does not read. `npm ci --ignore-scripts` succeeds, typechecking passes, and all 38 tests pass.
- DOM adapter: compared upstream Paseo source between tags `v0.14.0` and `v0.15.0`. Nothing that the adapter depends on has changed: the chat scroll, assistant message and `data-message-id` row markers, the plugin composer pill (`plugins/buttons`), and the web tooltip portal. The only tooltip change is to its native `Modal` import. The installed 0.15.0 web bundle still contains `agent-chat-scroll`, `assistant-message`, `data-message-id` rows, and React 19.2.3 `__reactFiber$` keys. Both releases ship React 19.2.3 and React Native 0.86.3.
- Host changes reviewed: 0.15.0 minifies client bundles (whitespace and syntax only, not identifiers), and it reinstalls plugins only when the connection client changes. Neither affects this plugin's selection listener or its cleanup.
- Not yet established: the plugin has not been reloaded or click-tested on Paseo 0.15.0. The manual checks below still apply.

## Hidden pill tooltip and dependency pins

Checked on 2026-11-03 on macOS with Paseo 0.14.0 and Node.js 25.6.1:

- Cause: Paseo 0.14.0 wraps each composer pill in a hover/focus tooltip. The selection menu and reply dialog are React portals rendered by the hidden pill, so React enter and focus events reached the pill and placed "Reply to selected text" at its zero-size rect, over the macOS window controls. Confirmed by reading the installed app bundle.
- Fix: pointer boundary events crossing into or out of those portals are dropped before React sees them, and focus events stop at the plugin's root view. A regression test covers the crossing rules and listener cleanup.
- Dependencies: `react-native` 0.88.1 (from a dependabot bump) required `react` ^19.3.0, so `npm ci` failed with ERESOLVE. Pinned `react` 19.2.3 and `react-native` 0.86.3. `npm ci --ignore-scripts` succeeds without flags, typechecking and all 38 tests pass, and `npm audit` reports 0 findings. Node.js 22.18.0 was not re-run.
- Live: the plugin was reloaded on the user's authorized installation, and the user confirmed the stray tooltip no longer appears when the selection menu shows. Keyboard focus in the reply dialog, split panes, compact layouts, and native fork/copy controls were not separately re-checked for this change.

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
