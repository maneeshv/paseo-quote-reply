Reply to a specific part of an assistant message by quoting it. Every completed assistant message gains a subtle Reply button underneath. On desktop and in the browser, selecting text inside a message shows a small floating Reply button next to the selection; the selection becomes the quote. Both open a dialog with the editable quoted text and a reply field, and the message is sent to the same chat as a Markdown blockquote followed by your reply.

For messages with a stable history marker, **Reply in new chat** appears beside Reply. It opens a reply form, then creates and opens a new chat on submission. The new agent receives earlier user/assistant messages and concise tool summaries and received agent messages up to that response as an attachment, plus your quoted reply. History is capped at 100,000 characters, with omission markers. This is a text-context fork, not a clone of hidden provider state. It uses the same workspace and visible model/settings; custom system prompts, tool policies, and per-agent MCP configuration are not copied. Workspace files remain shared.

An uncertain creation failure preserves the form and blocks resubmission; check the chat list before starting another. If opening a created chat fails, Open chat retries navigation without creating another agent.

Same-chat sends use Paseo's steer behavior. When the agent is working, the button says “Send & steer.” If steering is unavailable, Paseo may restart the current turn. Nothing is sent automatically, and a failed send keeps your draft with a reminder to check the chat before resending.

On mobile the dialog opens as a sheet and the Reply button quotes the whole message; use the Send button to submit. On desktop and web, Enter sends and Shift+Enter adds a newline in the reply field. Enter during IME composition does not send.

Requires Paseo 0.14.x. The plugin runs in the client and sends through your existing Paseo host and agent provider. It adds no backend service or external integration. Drafts stay in memory and are not saved across navigation or reload.
