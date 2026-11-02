import type { PluginClientContext } from "@getpaseo/plugin/client";
import { z } from "zod";
import { AssistantMessage, type AssistantMessageProps } from "@/client/assistant-reply";
import { NEW_CHAT_SCREEN_ID, NewChatReplyScreen, openNewChatReply } from "@/client/new-chat";

const KIND = "assistant-reply";

export default function contribute(client: PluginClientContext) {
  client.addScreen({
    id: NEW_CHAT_SCREEN_ID,
    title: "Reply in new chat",
    Component: NewChatReplyScreen,
  });
  client.addTimelineTransformer({
    id: "assistant-reply",
    query: { itemType: "assistant_message" },
    transform({ item, phase }) {
      // Claim only completed messages so streaming stays native.
      if (phase !== "complete" || item.text.length === 0) return undefined;
      return {
        items: [
          {
            type: "plugin",
            kind: KIND,
            version: 1,
            data: { text: item.text, ...(item.messageId ? { messageId: item.messageId } : {}) },
          },
        ],
      };
    },
  });
  client.addTimelineRenderer({
    kind: KIND,
    version: 1,
    schema: z.object({ text: z.string(), messageId: z.string().optional() }),
    Component: (props: Omit<AssistantMessageProps, "openNewChat">) => (
      <AssistantMessage
        {...props}
        openNewChat={(draft) => openNewChatReply((input) => client.openScreen(input), draft)}
      />
    ),
  });
  return () => {};
}
