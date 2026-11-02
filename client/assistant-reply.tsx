import { useAgent, usePaseo, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { observeMessageSelection, type MessageSelection } from "@/client/web";
import type { ReplyDraft } from "@/client/new-chat";
import { ReplyForm } from "@/client/reply-form";
import { formatQuoteReply } from "@/shared/quote";

export interface AssistantMessageData {
  text: string;
  messageId?: string;
}

export type AssistantMessageProps = PluginTimelineItemProps<AssistantMessageData> & {
  /** Opens the plugin's new-chat reply screen. Injected by the client entry. */
  openNewChat?: (draft: ReplyDraft) => void;
};

export function AssistantMessage({ item, agentId, theme, layout, openNewChat }: AssistantMessageProps) {
  const paseo = usePaseo();
  const uid = useId();
  const messageNativeId = `quote-reply-message-${uid}`;
  const text = item.data.text;
  const messageId = item.data.messageId;

  const [selection, setSelection] = useState<MessageSelection | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [popupWidth, setPopupWidth] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const agentStatus = useAgent(agentId, (agent) => agent.status);
  const busy = agentStatus === "running";

  // Only offer a new chat when the message has a stable fork checkpoint.
  const canForkNewChat = openNewChat !== undefined && messageId !== undefined;

  useEffect(
    () => observeMessageSelection(messageNativeId, setSelection),
    [messageNativeId],
  );

  const openDialog = useCallback((quoteText: string) => {
    // Fresh quote per open; the reply draft survives dismissal while mounted.
    setQuote(quoteText);
    setError(null);
    setOpen(true);
  }, []);

  const startNewChat = useCallback(
    (quoteText: string) => {
      if (!canForkNewChat || !openNewChat || !messageId) return;
      setSelection(null);
      openNewChat({ agentId, messageId, quote: quoteText });
    },
    [canForkNewChat, openNewChat, messageId, agentId],
  );

  // The popup's press-in and press both fire for one pointer gesture; opening
  // two draft screens would discard the first draft. Press-in marks the
  // gesture handled; keyboard activation fires onPress alone, so it still works.
  const openedSelectionRef = useRef<MessageSelection | null>(null);
  const openSelectionNewChat = (current: MessageSelection) => {
    // Press-in and press may both fire for one selection; keyboard remains usable on the next.
    if (openedSelectionRef.current === current) return;
    openedSelectionRef.current = current;
    startNewChat(current.text);
  };

  const submit = useCallback(async () => {
    if (sendingRef.current) return;
    const message = formatQuoteReply(quote, reply);
    if (message === null) {
      setError("Both the quote and the reply need some text.");
      return;
    }
    sendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      // Always explicit steer, even when idle. If the provider rejects
      // steering mid-turn, Paseo may fall back to restarting the turn.
      await paseo.agents.ref(agentId).send(message, { activeTurnBehavior: "steer" });
      setOpen(false);
      setReply("");
    } catch {
      // Outcome is uncertain; never retry automatically.
      setError("The send may not have gone through. Check the chat before sending again.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }, [agentId, paseo, quote, reply]);

  const handleOpenChange = useCallback((next: boolean) => {
    // Dismissing mid-send would hide an uncertain outcome; keep it open.
    if (!next && sendingRef.current) return;
    setOpen(next);
  }, []);

  const styles = useMemo(
    () => ({
      actionsRow: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 10,
        marginTop: 2,
      },
      replyRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingVertical: 4,
        paddingRight: 6,
      },
      replyLabel: { color: theme.colors.foregroundMuted, fontSize: 12 },
      floating: {
        position: "absolute" as const,
        zIndex: 10,
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        alignItems: "center" as const,
        gap: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      floatingButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
      },
      floatingLabel: { color: theme.colors.foreground, fontSize: 12 },
    }),
    [theme],
  );

  const openSelectionReply = useCallback(
    (current: MessageSelection) => {
      setSelection(null);
      openDialog(current.text);
    },
    [openDialog],
  );

  // Keep the floating popup inside the message pane: clamp with its measured
  // width (estimate until the first layout).
  const estimatedPopupWidth = popupWidth ?? (canForkNewChat ? 176 : 88);
  const floatingLeft =
    selection === null
      ? 0
      : Math.max(
          0,
          Math.min(
            selection.left,
            (contentWidth ?? selection.left + estimatedPopupWidth) - estimatedPopupWidth,
          ),
        );

  return (
    <View onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <View nativeID={messageNativeId}>
        <Markdown>{text}</Markdown>
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reply to this message"
          onPress={() => openDialog(text)}
          style={styles.replyRow}
        >
          <Icon name="Reply" size={12} color={theme.colors.foregroundMuted} />
          <Text style={styles.replyLabel}>Reply</Text>
        </Pressable>
        {canForkNewChat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reply to this message in a new chat"
            onPress={() => startNewChat(text)}
            style={styles.replyRow}
          >
            <Icon name="MessagesSquare" size={12} color={theme.colors.foregroundMuted} />
            <Text style={styles.replyLabel}>Reply in new chat</Text>
          </Pressable>
        ) : null}
      </View>
      {selection ? (
        <View
          onLayout={(event) => setPopupWidth(event.nativeEvent.layout.width)}
          style={[
            styles.floating,
            { top: selection.top + 6, left: floatingLeft },
            contentWidth !== null ? { maxWidth: contentWidth } : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reply to the selected text"
            // Press-in: the mousedown collapses the selection, which would
            // unmount this button before a click could land. onPress stays as
            // the keyboard/assistive-tech activation path; opening twice with
            // the same quote is harmless.
            onPressIn={() => openSelectionReply(selection)}
            onPress={() => openSelectionReply(selection)}
            style={styles.floatingButton}
          >
            <Icon name="Reply" size={12} color={theme.colors.foreground} />
            <Text style={styles.floatingLabel}>Reply</Text>
          </Pressable>
          {canForkNewChat ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reply to the selected text in a new chat"
              onPressIn={() => openSelectionNewChat(selection)}
              onPress={() => openSelectionNewChat(selection)}
              style={styles.floatingButton}
            >
              <Icon name="MessagesSquare" size={12} color={theme.colors.foreground} />
              <Text style={styles.floatingLabel}>New chat</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Modal title="Reply to message" open={open} onOpenChange={handleOpenChange}>
        <Modal.Content contentContainerStyle={{ padding: layout.compact ? 16 : 24 }}>
          <ReplyForm
            theme={theme}
            quote={quote}
            onQuoteChange={setQuote}
            reply={reply}
            onReplyChange={setReply}
            editable={!pending}
            pending={pending}
            error={error}
            hints={
              busy
                ? [
                    "The agent is working. Your reply steers the current turn; if steering is unavailable, Paseo may restart the turn.",
                  ]
                : undefined
            }
            sendLabel={busy ? "Send & steer" : "Send reply"}
            pendingLabel="Sending…"
            sendAccessibilityLabel={busy ? "Send and steer the running turn" : "Send reply"}
            sendDisabled={pending}
            onSubmit={() => void submit()}
          />
        </Modal.Content>
      </Modal>
    </View>
  );
}
