Reply to a specific part of an assistant message by quoting it. Every completed assistant message gains a subtle Reply button underneath. On desktop and in the browser, selecting text inside a message shows a small floating Reply button next to the selection; the selection becomes the quote. Both open a dialog with the editable quoted text and a reply field, and the message is sent to the same chat as a Markdown blockquote followed by your reply.

Sends use Paseo's steer behavior. When the agent is working, the button says “Send & steer.” If steering is unavailable, Paseo may restart the current turn. Nothing is sent automatically, and a failed send keeps your draft with a reminder to check the chat before resending.

On mobile the dialog opens as a sheet and the Reply button quotes the whole message; use the Send button to submit. On desktop and web, Enter sends and Shift+Enter adds a newline in the reply field. Enter during IME composition does not send.

Requires Paseo 0.14.x. The plugin runs in the client and sends through your existing Paseo host and agent provider. It adds no backend service or external integration. Drafts stay in the mounted message view and are not saved across navigation or reload.
