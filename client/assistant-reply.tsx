import { useAgent, usePaseo, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, Modal, TextInput } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { observeMessageSelection, observeReplySubmitKey, type MessageSelection } from "@/client/web";
import { formatQuoteReply } from "@/shared/quote";

export interface AssistantMessageData {
  text: string;
}

export function AssistantMessage({ item, agentId, theme, layout }: PluginTimelineItemProps<AssistantMessageData>) {
  const paseo = usePaseo();
  const uid = useId();
  const messageNativeId = `quote-reply-message-${uid}`;
  const inputNativeId = `quote-reply-input-${uid}`;
  const text = item.data.text;

  const [selection, setSelection] = useState<MessageSelection | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const agentStatus = useAgent(agentId, (agent) => agent.status);
  const busy = agentStatus === "running";

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

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (!open) return;
    return observeReplySubmitKey(inputNativeId, () => {
      void submitRef.current();
    });
  }, [open, inputNativeId]);

  const handleOpenChange = useCallback((next: boolean) => {
    // Dismissing mid-send would hide an uncertain outcome; keep it open.
    if (!next && sendingRef.current) return;
    setOpen(next);
  }, []);

  const styles = useMemo(
    () => ({
      replyRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        alignSelf: "flex-start" as const,
        paddingVertical: 4,
        paddingRight: 6,
        marginTop: 2,
      },
      replyLabel: { color: theme.colors.foregroundMuted, fontSize: 12 },
      floating: {
        position: "absolute" as const,
        zIndex: 10,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      floatingLabel: { color: theme.colors.foreground, fontSize: 12 },
      fieldLabel: { color: theme.colors.foregroundMuted, fontSize: 12 },
      input: {
        color: theme.colors.foreground,
        backgroundColor: theme.colors.surface1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
      },
      hint: { color: theme.colors.foregroundMuted, fontSize: 12 },
      error: { color: theme.colors.statusDanger, fontSize: 12 },
      send: {
        alignSelf: "flex-end" as const,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: theme.colors.accent,
      },
      sendPending: { opacity: 0.6 },
      sendLabel: { color: theme.colors.accentForeground, fontSize: 13 },
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

  // Keep the floating button inside the message pane. 88 ≈ its rendered width.
  const floatingLeft =
    selection === null
      ? 0
      : Math.max(0, Math.min(selection.left, (contentWidth ?? selection.left + 88) - 88));

  return (
    <View onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <View nativeID={messageNativeId}>
        <Markdown>{text}</Markdown>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reply to this message"
        onPress={() => openDialog(text)}
        style={styles.replyRow}
      >
        <Icon name="Reply" size={12} color={theme.colors.foregroundMuted} />
        <Text style={styles.replyLabel}>Reply</Text>
      </Pressable>
      {selection ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reply to the selected text"
          // Press-in: the mousedown collapses the selection, which would
          // unmount this button before a click could land. onPress stays as
          // the keyboard/assistive-tech activation path; opening twice with
          // the same quote is harmless.
          onPressIn={() => openSelectionReply(selection)}
          onPress={() => openSelectionReply(selection)}
          style={[styles.floating, { top: selection.top + 6, left: floatingLeft }]}
        >
          <Icon name="Reply" size={12} color={theme.colors.foreground} />
          <Text style={styles.floatingLabel}>Reply</Text>
        </Pressable>
      ) : null}
      <Modal title="Reply to message" open={open} onOpenChange={handleOpenChange}>
        <Modal.Content contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 12 }}>
          <Text style={styles.fieldLabel}>Quote</Text>
          <TextInput
            multiline
            value={quote}
            onChangeText={setQuote}
            editable={!pending}
            accessibilityLabel="Quoted text"
            style={[styles.input, { minHeight: 44, maxHeight: 140 }]}
          />
          <Text style={styles.fieldLabel}>Reply</Text>
          <TextInput
            multiline
            autoFocus
            nativeID={inputNativeId}
            value={reply}
            onChangeText={setReply}
            editable={!pending}
            accessibilityLabel="Your reply"
            placeholder="Write a reply…"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={[styles.input, { minHeight: 80, maxHeight: 180 }]}
          />
          {Platform.OS === "web" ? <Text style={styles.hint}>Enter to send · Shift+Enter for a new line</Text> : null}
          {busy ? (
            <Text style={styles.hint}>
              The agent is working. Your reply steers the current turn; if steering is
              unavailable, Paseo may restart the turn.
            </Text>
          ) : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "Send and steer the running turn" : "Send reply"}
            disabled={pending}
            onPress={() => void submit()}
            style={[styles.send, pending && styles.sendPending]}
          >
            <Text style={styles.sendLabel}>
              {pending ? "Sending…" : busy ? "Send & steer" : "Send reply"}
            </Text>
          </Pressable>
        </Modal.Content>
      </Modal>
    </View>
  );
}
