import { usePaseo, type PluginOpenScreenInput, type PluginScreenProps } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ScrollView, Text } from "react-native";
import { ReplyForm } from "@/client/reply-form";
import { createReplyChat, ForkPreparationError } from "@/shared/fork";
import { formatQuoteReply } from "@/shared/quote";

export const NEW_CHAT_SCREEN_ID = "new-chat-reply";

export interface ReplyDraft {
  agentId: string;
  messageId: string;
  quote: string;
}

// The creation outcome lives on this in-memory record, not in component state,
// so navigating away during a pending create and reopening the screen can
// never create a second agent: the record is consulted and updated
// synchronously around every create, and the UI initializes from it.
// The screen param is an opaque counter; no quote or agent data in the URL.
// shortcut: a single draft slot — opening another reply replaces it, and the
// screen for the replaced draft shows "no longer available".
interface DraftRecord {
  key: string;
  draft: ReplyDraft;
  status: "idle" | "pending" | "created" | "blocked";
  createdAgentId: string | null;
}

let record: DraftRecord | null = null;
let draftCounter = 0;
const listeners = new Set<() => void>();

function getRecord() {
  return record;
}

function subscribeRecord(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateRecord(key: string, patch: Partial<Pick<DraftRecord, "status" | "createdAgentId">>) {
  // A newer draft replaced this one; drop the stale continuation's update.
  if (record?.key !== key) return;
  record = { ...record, ...patch };
  for (const listener of listeners) listener();
}

export function openNewChatReply(
  openScreen: (input: PluginOpenScreenInput) => void,
  draft: ReplyDraft,
) {
  draftCounter += 1;
  const key = String(draftCounter);
  record = { key, draft, status: "idle", createdAgentId: null };
  for (const listener of listeners) listener();
  openScreen({ screenId: NEW_CHAT_SCREEN_ID, params: { draft: key } });
}

const HISTORY_HINT =
  "The new chat starts in the same workspace and carries earlier messages and " +
  "summarized tool activity up to the chosen message (capped at 100,000 characters).";

const AMBIGUOUS_ERROR =
  "Creating the chat may or may not have succeeded. Check the workspace chat list before replying again.";

export function NewChatReplyScreen(props: PluginScreenProps) {
  const live = useSyncExternalStore(subscribeRecord, getRecord);
  const key = props.params.draft ?? "";
  const match = live?.key === key ? live : undefined;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: props.theme.colors.surface0 }}
      contentContainerStyle={{ flexGrow: 1, padding: props.layout.compact ? 16 : 24, gap: 12 }}
    >
      {match ? (
        // Key by draft so a newly opened reply gets fresh form state.
        <NewChatReplyForm key={key} record={match} {...props} />
      ) : (
        <Text style={{ color: props.theme.colors.foregroundMuted, fontSize: 13 }}>
          This reply draft is no longer available. Go back to the message and choose Reply in new
          chat again.
        </Text>
      )}
    </ScrollView>
  );
}

function NewChatReplyForm({
  record: current,
  theme,
  navigation,
}: PluginScreenProps & { record: DraftRecord }) {
  const paseo = usePaseo();
  const openAgent = navigation?.openAgent;
  const { key, draft, status, createdAgentId } = current;

  const [quote, setQuote] = useState(draft.quote);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Navigating away must not be undone by auto-navigation when a pending
  // create finishes; the outcome still persists on the record either way.
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const submit = useCallback(async () => {
    // Guard on the live module record, not the rendered snapshot, so a second
    // submission in the same tick (or after a remount) can never create twice.
    const live = getRecord();
    if (live?.key !== key || live.status === "pending" || live.status === "blocked") return;
    if (live.status === "created") {
      // The chat already exists; only retry opening it, never create another.
      try {
        if (live.createdAgentId) openAgent?.({ agentId: live.createdAgentId });
      } catch {
        setError("The chat could not be opened. Find it in the workspace chat list.");
      }
      return;
    }
    const message = formatQuoteReply(quote, reply);
    if (message === null) {
      setError("Both the quote and the reply need some text.");
      return;
    }
    if (!openAgent) {
      setError("This app version cannot open the new chat, so it was not created.");
      return;
    }
    setError(null);
    updateRecord(key, { status: "pending" });
    let id: string;
    try {
      id = await createReplyChat(paseo, draft.agentId, draft.messageId, message);
      updateRecord(key, { status: "created", createdAgentId: id });
    } catch (err) {
      if (err instanceof ForkPreparationError) {
        // Failed before creation; safe to correct the draft and retry.
        updateRecord(key, { status: "idle" });
        setError(err.message);
      } else {
        updateRecord(key, { status: "blocked" });
      }
      return;
    }
    if (!activeRef.current || getRecord()?.key !== key) return;
    try {
      openAgent({ agentId: id });
    } catch {
      setError("The chat was created but could not be opened. Press Open chat to try again.");
    }
  }, [key, draft, openAgent, quote, reply, paseo]);

  const hints = useMemo(() => {
    const list = [HISTORY_HINT];
    if (!openAgent && status !== "created") {
      list.push("Opening chats is unavailable in this app version.");
    }
    return list;
  }, [openAgent, status]);

  const pending = status === "pending";
  const blocked = status === "blocked";
  const created = status === "created" && createdAgentId !== null;

  return (
    <ReplyForm
      theme={theme}
      quote={quote}
      onQuoteChange={setQuote}
      reply={reply}
      onReplyChange={setReply}
      editable={status === "idle"}
      pending={pending}
      error={error ?? (blocked ? AMBIGUOUS_ERROR : null)}
      hints={hints}
      sendLabel={created ? "Open chat" : "Create chat"}
      pendingLabel="Creating…"
      sendAccessibilityLabel={
        created ? "Open the created chat" : "Create a new chat with this reply"
      }
      sendDisabled={pending || blocked}
      onSubmit={() => void submit()}
    />
  );
}
