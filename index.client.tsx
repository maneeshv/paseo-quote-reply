import type { PluginButtonIconProps, PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import { SelectionReply } from "@/client/assistant-reply";
import { NEW_CHAT_SCREEN_ID, NewChatReplyScreen, openNewChatReply, type ReplyDraft } from "@/client/new-chat";
import { registerSelectionReplies } from "@/client/register-selection";

export default function contribute(client: PluginClientContext) {
  const removeScreen = client.addScreen({
    id: NEW_CHAT_SCREEN_ID,
    title: "Reply in new chat",
    Component: NewChatReplyScreen,
  });
  // This selection bridge relies on Paseo's web DOM, including its desktop app.
  const removeSelection = Platform.OS === "web"
    ? registerSelectionReplies(client, (props: PluginButtonIconProps) => (
      <SelectionReply
        {...props}
        openNewChat={(draft: ReplyDraft) => openNewChatReply((input) => client.openScreen(input), draft)}
      />
    ))
    : () => {};
  return () => {
    removeSelection();
    removeScreen();
  };
}
