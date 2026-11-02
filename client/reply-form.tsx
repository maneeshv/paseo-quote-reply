import type { PluginHostProps } from "@getpaseo/plugin/client";
import { TextInput } from "@getpaseo/plugin/client/ui";
import { useEffect, useId, useMemo, useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { observeReplySubmitKey } from "@/client/web";

export interface ReplyFormProps {
  theme: PluginHostProps["theme"];
  quote: string;
  onQuoteChange: (text: string) => void;
  reply: string;
  onReplyChange: (text: string) => void;
  /** Disables both inputs. */
  editable: boolean;
  pending: boolean;
  error: string | null;
  /** Context hints rendered between the fields and the error. */
  hints?: readonly string[];
  sendLabel: string;
  pendingLabel: string;
  sendAccessibilityLabel: string;
  sendDisabled: boolean;
  onSubmit: () => void;
}

/** Quote + reply fields with Enter-to-send (Shift+Enter newline, IME safe). */
export function ReplyForm({
  theme,
  quote,
  onQuoteChange,
  reply,
  onReplyChange,
  editable,
  pending,
  error,
  hints,
  sendLabel,
  pendingLabel,
  sendAccessibilityLabel,
  sendDisabled,
  onSubmit,
}: ReplyFormProps) {
  const uid = useId();
  const inputNativeId = `quote-reply-input-${uid}`;

  const submitRef = useRef(onSubmit);
  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);
  useEffect(
    () => observeReplySubmitKey(inputNativeId, () => submitRef.current()),
    [inputNativeId],
  );

  const styles = useMemo(
    () => ({
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
      sendDisabled: { opacity: 0.6 },
      sendLabel: { color: theme.colors.accentForeground, fontSize: 13 },
    }),
    [theme],
  );

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.fieldLabel}>Quote</Text>
      <TextInput
        multiline
        value={quote}
        onChangeText={onQuoteChange}
        editable={editable}
        accessibilityLabel="Quoted text"
        style={[styles.input, { minHeight: 44, maxHeight: 140 }]}
      />
      <Text style={styles.fieldLabel}>Reply</Text>
      <TextInput
        multiline
        autoFocus
        nativeID={inputNativeId}
        value={reply}
        onChangeText={onReplyChange}
        editable={editable}
        accessibilityLabel="Your reply"
        placeholder="Write a reply…"
        placeholderTextColor={theme.colors.foregroundMuted}
        style={[styles.input, { minHeight: 80, maxHeight: 180 }]}
      />
      {Platform.OS === "web" ? (
        <Text style={styles.hint}>Enter to send · Shift+Enter for a new line</Text>
      ) : null}
      {hints?.map((hint) => (
        <Text key={hint} style={styles.hint}>
          {hint}
        </Text>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sendAccessibilityLabel}
        disabled={sendDisabled}
        onPress={onSubmit}
        style={[styles.send, sendDisabled && styles.sendDisabled]}
      >
        <Text style={styles.sendLabel}>{pending ? pendingLabel : sendLabel}</Text>
      </Pressable>
    </View>
  );
}
