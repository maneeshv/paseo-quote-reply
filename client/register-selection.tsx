import type { PaseoAgent, PaseoAgentListResult } from "@getpaseo/client";
import type { PluginButtonIcon, PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";

/** Mount an agent-scoped selection listener without transforming native timeline rows. */
export function registerSelectionReplies(client: PluginClientContext, icon: PluginButtonIcon) {
  const lifetime = new AbortController();
  const pills = new Map<string, { workspaceId: string; registration: PluginButtonRegistration }>();
  let generation = 0;
  let touched = new Set<string>();
  let unsubscribe: (() => void) | undefined;
  let observation: NonNullable<PaseoAgentListResult["subscription"]> | undefined;
  const report = (error: unknown) => {
    if (!lifetime.signal.aborted) console.error("Quote Reply: agent observation failed", error);
  };
  const remove = (id: string) => {
    pills.get(id)?.registration.remove();
    pills.delete(id);
  };
  const register = (agent: PaseoAgent) => {
    if (lifetime.signal.aborted) return;
    const workspaceId = agent.workspaceId;
    if (!workspaceId || agent.archivedAt) return remove(agent.id);
    // Ordinary status updates must not remount the listener or discard an open reply.
    if (pills.get(agent.id)?.workspaceId === workspaceId) return;
    remove(agent.id);
    pills.set(agent.id, {
      workspaceId,
      registration: client.addComposerPill({
        id: "quote-selection",
        workspaceId,
        agentId: agent.id,
        button: {
          title: "Reply to selected text",
          label: "Reply to selected text",
          icon,
          behavior: { kind: "action", onPress() {} },
        },
      }),
    });
  };
  const hydrate = async (first: PaseoAgentListResult) => {
    const current = ++generation;
    touched = new Set<string>();
    const changed = touched;
    const present = new Set<string>();
    const cursors = new Set<string>();
    let page = first;
    for (;;) {
      if (lifetime.signal.aborted || current !== generation) return;
      for (const { agent } of page.entries) {
        present.add(agent.id);
        if (!changed.has(agent.id)) register(agent);
      }
      if (!page.pageInfo.hasMore) break;
      const cursor = page.pageInfo.nextCursor;
      if (!cursor || cursors.has(cursor)) throw new Error("Agent pagination did not advance");
      cursors.add(cursor);
      page = await client.paseo.agents.list({
        page: { limit: 200, cursor },
        includeBackground: true,
        signal: lifetime.signal,
      });
    }
    // Reconnect snapshots remove vanished agents only after complete pagination.
    for (const id of pills.keys()) {
      if (!present.has(id) && !changed.has(id)) remove(id);
    }
  };
  void client.paseo.agents.list({ subscribe: {}, includeBackground: true, signal: lifetime.signal }).then(({ subscription }) => {
    observation = subscription;
    if (lifetime.signal.aborted) {
      void subscription.release().catch(report);
      return;
    }
    unsubscribe = subscription.subscribe({
      snapshot(snapshot) { void hydrate(snapshot).catch(report); },
      update(message) {
        if (lifetime.signal.aborted || message.type !== "agent_update") return;
        const update = message.payload;
        if (update.kind === "upsert") {
          touched.add(update.agent.id);
          register(update.agent);
        } else {
          touched.add(update.agentId);
          remove(update.agentId);
        }
      },
      error: report,
    });
  }).catch(report);
  return () => {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    generation += 1;
    unsubscribe?.();
    if (observation) void observation.release().catch(report);
    for (const id of pills.keys()) remove(id);
  };
}
