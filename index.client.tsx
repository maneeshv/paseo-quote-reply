import type { PluginClientContext } from "@getpaseo/plugin/client";
import { z } from "zod";
import { AssistantMessage } from "@/client/assistant-reply";

const KIND = "assistant-reply";

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "assistant-reply",
    query: { itemType: "assistant_message" },
    transform({ item, phase }) {
      // Claim only completed messages so streaming stays native.
      if (phase !== "complete" || item.text.length === 0) return undefined;
      return {
        items: [{ type: "plugin", kind: KIND, version: 1, data: { text: item.text } }],
      };
    },
  });
  client.addTimelineRenderer({
    kind: KIND,
    version: 1,
    schema: z.object({ text: z.string() }),
    Component: AssistantMessage,
  });
  return () => {};
}
