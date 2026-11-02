import type { PaseoApi, PaseoAgentConfig, PaseoWorkspaceAgentCreateOptions } from "@getpaseo/client";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import { buildToolCallDisplayModel } from "@getpaseo/protocol/tool-call-display";

const MAX_CONTEXT = 100_000;
const HEADER = "<chat-history-summary>\nChat history from a previous Paseo agent.\n\n";
const FOOTER = "\n</chat-history-summary>";
const OMITTED = "[Earlier chat history omitted]\n";

export interface ForkHistory {
  error: string | null;
  epoch: string;
  projection: "projected" | "canonical";
  reset: boolean;
  staleCursor: boolean;
  gap: boolean;
  hasOlder: boolean;
  hasNewer: boolean;
  entries: Array<{ item: AgentTimelineItem; seqStart: number; seqEnd: number }>;
}

/** A bounded text handoff, not a clone of hidden provider/session state. */
export function buildForkHistory(history: ForkHistory, messageId: string): string {
  if (!messageId.trim()) throw new Error("This message has no stable fork checkpoint.");
  if (history.error || history.projection !== "projected" || !history.epoch || history.reset || history.staleCursor || history.gap || history.hasOlder || history.hasNewer) {
    throw new Error("Complete chat history is unavailable or changed. Try again after it settles.");
  }
  const boundary = history.entries.findLast((entry) =>
    entry.item.type === "assistant_message" && entry.item.messageId === messageId,
  );
  if (!boundary) throw new Error("The selected assistant message is no longer available.");
  if (history.entries.some((entry) => entry.seqStart <= boundary.seqEnd && entry.seqEnd > boundary.seqEnd)) {
    throw new Error("This checkpoint changed. Select a later completed response.");
  }
  const entries: string[] = [];
  for (const { item, seqEnd } of history.entries) {
    if (seqEnd > boundary.seqEnd) continue;
    if (item.type === "user_message" || item.type === "assistant_message") {
      const text = item.text.trim();
      if (text) entries.push(`[${item.type === "user_message" ? "User" : "Assistant"}] ${text}`);
    } else if (item.type === "tool_call") {
      // Native display summaries omit arbitrary raw tool input/output.
      const display = buildToolCallDisplayModel(item);
      const summary = display.summary?.replace(/\s+/g, " ").trim();
      const concise = summary && summary.length > 200 ? `${summary.slice(0, 197)}...` : summary;
      entries.push(concise ? `[${display.displayName}] ${concise}` : `[${display.displayName}]`);
      const message = item.agentMessage?.text.trim();
      if (message) entries.push(message);
      // shortcut: subagent logs are omitted; add them if full native fork parity is needed.
    }
  }
  const budget = MAX_CONTEXT - HEADER.length - FOOTER.length;
  let body = entries.join("\n");
  if (body.length > budget) {
    const kept: string[] = [];
    let remaining = budget - OMITTED.length;
    for (let i = entries.length - 1; i >= 0; i--) {
      const text = entries[i]!;
      const size = text.length + (kept.length ? 1 : 0);
      if (size > remaining) {
        if (!kept.length) {
          const marker = "\n[Message truncated]\n";
          const available = remaining - marker.length;
          const head = Math.ceil(available / 2);
          kept.push(text.slice(0, head) + marker + text.slice(-(available - head)));
        }
        break;
      }
      kept.push(text);
      remaining -= size;
    }
    body = OMITTED + kept.reverse().join("\n");
  }
  return HEADER + body + FOOTER;
}

export class ForkPreparationError extends Error {
  override name = "ForkPreparationError";
}

/** Creates once in the source workspace; never sends to or changes the source agent. */
export async function createReplyChat(
  paseo: PaseoApi,
  agentId: string,
  messageId: string,
  prompt: string,
): Promise<string> {
  let workspaceId: string;
  let options: PaseoWorkspaceAgentCreateOptions;
  try {
    if (!prompt.trim()) throw new Error("Write a reply before creating a chat.");
    const history = await paseo.agents.ref(agentId).timeline.refetch({
      direction: "tail", limit: 0, projection: "projected",
    });
    const text = buildForkHistory(history, messageId);
    const source = history.agent;
    const provider = source?.provider.trim();
    const model = (source?.model ?? source?.runtimeInfo?.model)?.trim();
    const modeId = source?.currentModeId ?? source?.runtimeInfo?.modeId;
    if (!source || source.id !== agentId || !source.workspaceId || !provider || !model) {
      throw new Error("The source workspace, provider, or model is unavailable; a matching chat cannot be created.");
    }
    const config: PaseoAgentConfig = {
      provider: `${provider}/${model}`,
      ...(modeId ? { modeId } : {}),
      thinkingOptionId: source.thinkingOptionId ?? source.runtimeInfo?.thinkingOptionId ?? undefined,
      featureValues: Object.fromEntries((source.features ?? []).map((feature) => [feature.id, feature.value])),
    };
    // The public snapshot exposes visible settings, not custom system prompts, tool policies or MCP configuration.
    workspaceId = source.workspaceId;
    options = {
      config,
      prompt,
      attachments: [{ type: "text", mimeType: "text/plain", contextKind: "chat_history", title: "Chat history", text }],
    };
  } catch (error) {
    throw new ForkPreparationError(error instanceof Error ? error.message : "Could not prepare chat history.");
  }
  const created = await paseo.workspaces.ref(workspaceId).agents.create(options);
  return created.id;
}
