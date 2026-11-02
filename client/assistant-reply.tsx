import { useAgent, usePaseo, type PluginButtonIconProps } from "@getpaseo/plugin/client";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { observeNativeMessageSelection, type NativeMessageSelection } from "@/client/web";
import type { ReplyDraft } from "@/client/new-chat";
import { ReplyForm } from "@/client/reply-form";
import { formatQuoteReply } from "@/shared/quote";

export type SelectionReplyProps = PluginButtonIconProps & {
  /** Opens the plugin's new-chat reply screen. Injected by the client entry. */
  openNewChat?: (draft: ReplyDraft) => void;
};

/**
 * Mounted as a hidden composer pill icon: the pill supplies the agent scope
 * and a DOM foothold, while the selection menu and reply modal render through
 * portals outside the hidden pill.
 */
export function SelectionReply(props: SelectionReplyProps) {
  if (props.context !== "agent") return null;
  return <SelectionReplyInner key={`${props.host.id}:${props.agentId}`} {...props} agentId={props.agentId} />;
}

function SelectionReplyInner({
  agentId,
  theme,
  layout,
  openNewChat,
}: SelectionReplyProps & { agentId: string }) {
  const paseo = usePaseo();
  const uid = useId();
  // The web helper finds this marker by prefix and hides its pill button.
  const markerId = `quote-reply-anchor-${uid}`;

  const [selection, setSelection] = useState<NativeMessageSelection | null>(null);
  const [menuSize, setMenuSize] = useState<{ width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const agentStatus = useAgent(agentId, (agent) => agent.status);
  const busy = agentStatus === "running";

  useEffect(
    () => observeNativeMessageSelection(markerId, setSelection),
    [markerId],
  );

  const openDialog = useCallback((quoteText: string) => {
    // Fresh quote per open; the reply draft survives dismissal while mounted.
    setQuote(quoteText);
    setError(null);
    setOpen(true);
  }, []);

  const openSelectionReply = useCallback(
    (current: NativeMessageSelection) => {
      setSelection(null);
      if (!current.isValid()) return;
      openDialog(current.text);
    },
    [openDialog],
  );

  const startNewChat = useCallback(
    (current: NativeMessageSelection) => {
      if (!openNewChat) return;
      setSelection(null);
      // The observer clears stale selections, but re-check at press time so a
      // just-changed or moved row can never seed a fork draft.
      if (!current.isValid()) return;
      openNewChat({ agentId, messageId: current.messageId, quote: current.text });
    },
    [openNewChat, agentId],
  );

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
      menu: {
        position: "absolute" as const,
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
      menuButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingVertical: 2,
      },
      menuLabel: { color: theme.colors.foreground, fontSize: 12 },
    }),
    [theme],
  );

  // Clamp the menu inside the viewport with its measured size (estimate until
  // the first layout); narrow panes wrap via maxWidth + flexWrap.
  const menuWidth = menuSize?.width ?? 176;
  const menuHeight = menuSize?.height ?? 30;
  const menuLeft =
    selection === null
      ? 0
      : Math.max(8, Math.min(selection.left, selection.viewportWidth - menuWidth - 8));
  const menuTop =
    selection === null
      ? 0
      : Math.max(8, Math.min(selection.top, selection.viewportHeight - menuHeight - 8));

  return (
    <View nativeID={markerId} style={{ width: 0, height: 0 }}>
      {selection ? (
        <RNModal transparent visible animationType="none" onRequestClose={() => setSelection(null)}>
          <View style={{ flex: 1 }} testID="quote-reply-selection-menu">
            <Pressable
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss reply options"
              onPress={() => setSelection(null)}
            />
            <View
              onLayout={(event) =>
                setMenuSize({
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                })
              }
              style={[
                styles.menu,
                { top: menuTop, left: menuLeft, maxWidth: selection.viewportWidth - 16 },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reply to the selected text"
                onPress={() => openSelectionReply(selection)}
                style={styles.menuButton}
              >
                <Icon name="Reply" size={12} color={theme.colors.foreground} />
                <Text style={styles.menuLabel}>Reply</Text>
              </Pressable>
              {openNewChat ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reply to the selected text in a new chat"
                  onPress={() => startNewChat(selection)}
                  style={styles.menuButton}
                >
                  <Icon name="MessagesSquare" size={12} color={theme.colors.foreground} />
                  <Text style={styles.menuLabel}>New chat</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </RNModal>
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
