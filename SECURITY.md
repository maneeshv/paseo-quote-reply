# Security

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/maneeshv/paseo-quote-reply/security/advisories/new). Do not post exploit details, credentials, or private conversation content in public issues. If private reporting is unavailable, ask the owner for a private contact without disclosing the vulnerability.

Include the affected commit, Paseo app and daemon versions, operating system, and reproduction steps with synthetic data. This is a community project with no guaranteed response time. Fixes target the latest main branch rather than older snapshots.

## Trust and data handling

Paseo plugins are trusted, unsandboxed code. This plugin runs in the client and uses the current host connection; it is not an additional authorization or tenant-isolation boundary.

The plugin observes agent metadata, reads selected assistant text, sends quoted replies, and reads projected history when creating a new chat. The quote, reply, and attached history go through Paseo to the configured model provider. The plugin adds no telemetry endpoint or backend service, but normal Paseo/provider storage and retention still apply.

New chats share the source workspace files. They copy only visible provider/model/mode/thinking/features; custom system prompts, tool policies, per-agent MCP configuration, and hidden provider state are not cloned. Do not assume a new chat inherits every source-agent restriction.

The DOM adapter was reviewed against Paseo 0.14.0, 0.15.0, and 0.15.1. The manifest allows any later 0.x release, so the adapter must keep failing closed on unfamiliar markup. It rejects ambiguous pane ownership, cross-message selections, and stale rows. Preserve those checks and native message rendering when modifying it. Sending to a running agent requests steering, which Paseo may implement by restarting the turn. An uncertain send must not be retried automatically.

Never attach unredacted logs, account files, access tokens, or private transcripts to reports. The plugin does not redact arbitrary secrets in user-submitted quotes or history.

## Dependency status

On 2026-11-03, after pinning `react` 19.2.3 and `react-native` 0.86.3 (the versions Paseo 0.14.0 ships and its plugin SDK is built against), `npm audit` reported 0 findings and `minimatch` is no longer in the tree. The earlier 12 moderate findings came from [a minimatch denial-of-service advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) in the React Native 0.81.5 chain. Do not use `npm audit fix --force` without checking host compatibility.

These dependencies support development checks; Paseo supplies runtime modules. The lockfile audit does not assess Paseo's own runtime dependency tree. Re-run the audit when dependencies change.
