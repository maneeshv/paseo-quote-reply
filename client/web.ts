import { Platform } from "react-native";
import { isSelectionInside, shouldSendOnEnter } from "@/shared/quote";

// Browser-only selection and keyboard handling. The plugin typechecks without
// the DOM library; declare only the structure this module actually touches.
// Every export is gated on Platform.OS === "web" and no-ops on native.

interface DomRect {
  top: number;
  left: number;
  bottom: number;
}

interface DomElement {
  contains(node: unknown): boolean;
  getBoundingClientRect(): DomRect;
}

interface DomKeyboardEvent {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  target: { id?: string } | null;
  preventDefault(): void;
  stopPropagation(): void;
}

interface DomSelection {
  isCollapsed: boolean;
  rangeCount: number;
  anchorNode: unknown;
  focusNode: unknown;
  getRangeAt(index: number): { getBoundingClientRect(): DomRect };
  toString(): string;
}

declare const document: {
  getElementById(id: string): DomElement | null;
  getSelection(): DomSelection | null;
  addEventListener(type: string, listener: (event: DomKeyboardEvent) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: DomKeyboardEvent) => void, capture?: boolean): void;
};

declare const window: {
  addEventListener(type: string, listener: () => void, capture?: boolean): void;
  removeEventListener(type: string, listener: () => void, capture?: boolean): void;
};

export interface MessageSelection {
  text: string;
  /** Offsets relative to the message content element's top-left corner. */
  top: number;
  left: number;
}

/**
 * Watches the browser selection for one mounted message. Reports a selection
 * only when both endpoints sit inside that message's own content element
 * (found by its nativeID); reports null when the selection collapses, moves
 * to another message, or the page scrolls or resizes (the rect goes stale).
 */
export function observeMessageSelection(
  nativeId: string,
  onChange: (selection: MessageSelection | null) => void,
): () => void {
  if (Platform.OS !== "web") return () => {};
  const update = () => {
    const element = document.getElementById(nativeId);
    const selection = document.getSelection();
    if (
      !element ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !isSelectionInside(element, selection.anchorNode, selection.focusNode)
    ) {
      onChange(null);
      return;
    }
    const text = selection.toString();
    if (!text.trim()) {
      onChange(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const host = element.getBoundingClientRect();
    onChange({
      text,
      top: rect.bottom - host.top,
      left: Math.max(0, rect.left - host.left),
    });
  };
  const clear = () => onChange(null);
  document.addEventListener("selectionchange", update);
  // Capture phase so the timeline's inner scroller also clears the stale rect.
  window.addEventListener("scroll", clear, true);
  window.addEventListener("resize", clear);
  return () => {
    document.removeEventListener("selectionchange", update);
    window.removeEventListener("scroll", clear, true);
    window.removeEventListener("resize", clear);
  };
}

/**
 * Enter in the plugin's own reply input sends; Shift+Enter and an
 * IME-composing Enter fall through to the textarea. The listener lives on the
 * document so it survives the modal's mount timing, but it only reacts to the
 * plugin-owned input matched by nativeID.
 */
export function observeReplySubmitKey(inputNativeId: string, onSend: () => void): () => void {
  if (Platform.OS !== "web") return () => {};
  const listener = (event: DomKeyboardEvent) => {
    if (event.target?.id !== inputNativeId) return;
    if (!shouldSendOnEnter(event)) return;
    event.preventDefault();
    event.stopPropagation();
    onSend();
  };
  document.addEventListener("keydown", listener, true);
  return () => document.removeEventListener("keydown", listener, true);
}
