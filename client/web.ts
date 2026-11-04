import { Platform } from "react-native";
import { shouldSendOnEnter } from "@/shared/quote";

interface DomRect { top: number; left: number; bottom: number }
interface DomNode { parentElement: DomElement | null; nodeType?: number }
interface DomElement extends DomNode {
  isConnected: boolean;
  textContent: string | null;
  style: { display: string };
  contains(node: unknown): boolean;
  closest(selector: string): DomElement | null;
  querySelectorAll(selector: string): ArrayLike<DomElement>;
  getAttribute(name: string): string | null;
}
interface DomKeyboardEvent {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  target: (DomNode & { id?: string }) | null;
  preventDefault(): void;
  stopPropagation(): void;
}
interface DomBoundaryEvent {
  target: DomNode | null;
  relatedTarget: DomNode | null;
  stopPropagation(): void;
}
interface ReactFiber { stateNode: unknown; return: ReactFiber | null }
interface DomSelection {
  isCollapsed: boolean;
  rangeCount: number;
  anchorNode: DomNode | null;
  focusNode: DomNode | null;
  getRangeAt(index: number): { getBoundingClientRect(): DomRect };
  toString(): string;
}
declare const document: {
  body: DomElement;
  getElementById(id: string): DomElement | null;
  getSelection(): DomSelection | null;
  addEventListener(type: string, listener: (event: DomKeyboardEvent) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: DomKeyboardEvent) => void, capture?: boolean): void;
};
declare const window: {
  innerWidth: number;
  innerHeight: number;
  addEventListener(type: string, listener: (event: DomBoundaryEvent) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: DomBoundaryEvent) => void, capture?: boolean): void;
};
declare const MutationObserver: {
  new(callback: () => void): {
    observe(element: DomElement, options: { childList: boolean; subtree: boolean; characterData: boolean; attributes: boolean; attributeFilter: string[] }): void;
    disconnect(): void;
  };
};

export interface NativeMessageSelection {
  text: string;
  messageId: string;
  top: number;
  left: number;
  viewportWidth: number;
  viewportHeight: number;
  isValid(): boolean;
}

const CHAT = '[data-testid="agent-chat-scroll"]';
const ASSISTANT = '[data-testid="assistant-message"]';
const ANCHOR = '[id^="quote-reply-anchor-"]';
const MENU = '[data-testid="quote-reply-selection-menu"]';
const BOUNDARY_EVENTS = ["pointerover", "pointerout", "mouseover", "mouseout"];
const elementOf = (node: DomNode | null) => node?.nodeType === 1 ? node as DomElement : node?.parentElement ?? null;

/** True when React renders `node` beneath `owner`, including through portals mounted elsewhere in the DOM. */
function isReactDescendant(node: DomNode | null, owner: DomElement): boolean {
  for (let element = elementOf(node); element; element = element.parentElement) {
    const fields = element as unknown as Record<string, ReactFiber | undefined>;
    const key = Object.keys(fields).find((name) => name.startsWith("__reactFiber$"));
    if (!key) continue;
    // ponytail: walks to the root per crossing; cache per element in a WeakMap if hover profiling shows cost.
    for (let fiber: ReactFiber | null | undefined = fields[key]; fiber; fiber = fiber.return) {
      if (fiber.stateNode === owner) return true;
    }
    return false;
  }
  return false;
}

/** Observe native messages without replacing them or changing their action controls. */
export function observeNativeMessageSelection(
  markerId: string,
  onChange: (selection: NativeMessageSelection | null) => void,
): () => void {
  if (Platform.OS !== "web") return () => {};
  const marker = document.getElementById(markerId);
  const button = marker?.closest('[role="button"]');
  if (!marker || !button || !button.contains(marker)) return () => {};
  const oldDisplay = button.style.display;
  // Hide only our own registered pill; its mounted icon supplies the exact agent context.
  button.style.display = "none";
  // Paseo wraps the pill in a hover tooltip, and React dispatches enter events along the React tree,
  // so hovering a portal the pill renders (selection menu, reply dialog) would "enter" the hidden pill
  // and pin "Reply to selected text" at its 0,0 rect over the window controls. Drop pointer crossings
  // into or out of those portals before React's root listeners see them.
  const isolatePortals = (event: DomBoundaryEvent) => {
    if (isReactDescendant(event.target, button) !== isReactDescendant(event.relatedTarget, button)) {
      event.stopPropagation();
    }
  };

  const scope = () => {
    if (!marker.isConnected || document.getElementById(markerId) !== marker) return null;
    // shortcut: DOM markers checked for Paseo 0.14.0 and 0.15.0; fail closed until adapted if the pane structure changes.
    for (let node = button.parentElement; node && node !== document.body; node = node.parentElement) {
      const chats = node.querySelectorAll(CHAT);
      const anchors = node.querySelectorAll(ANCHOR);
      if (chats.length > 1 || anchors.length > 1) return null;
      if (chats.length === 1 && anchors.length === 1 && anchors[0] === marker) {
        return { pane: node, chat: chats[0]! };
      }
    }
    return null;
  };

  let current: NativeMessageSelection | null = null;
  const observer = new MutationObserver(() => {
    if (current && !current.isValid()) clear();
  });
  const clear = () => {
    current = null;
    observer.disconnect();
    onChange(null);
  };
  const update = (event: DomKeyboardEvent) => {
    const target = elementOf(event.target);
    if (target?.closest(MENU) || target?.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
    const selected = document.getSelection();
    const owner = scope();
    const assistant = elementOf(selected?.anchorNode ?? null)?.closest(ASSISTANT);
    const row = assistant?.closest('[data-message-id]');
    const messageId = row?.getAttribute('data-message-id');
    if (!owner || !selected || selected.isCollapsed || selected.rangeCount === 0 ||
        !assistant || !row || !messageId || !owner.chat.contains(assistant) ||
        !assistant.contains(selected.anchorNode) || !assistant.contains(selected.focusNode) ||
        !selected.toString().trim()) {
      clear();
      return;
    }
    const content = assistant.textContent;
    const rect = selected.getRangeAt(0).getBoundingClientRect();
    const isValid = () => {
      const live = scope();
      return live?.pane === owner.pane && live.chat === owner.chat && row.isConnected &&
        owner.chat.contains(assistant) && assistant.textContent === content &&
        row.getAttribute('data-message-id') === messageId;
    };
    current = {
      text: selected.toString(), messageId, top: rect.bottom + 6, left: rect.left,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, isValid,
    };
    observer.disconnect();
    observer.observe(owner.pane, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-message-id'] });
    onChange(current);
  };
  // Wait until selection finishes so mounting the popup cannot interrupt a drag.
  document.addEventListener("pointerup", update);
  document.addEventListener("keyup", update);
  window.addEventListener("scroll", clear, true);
  window.addEventListener("resize", clear);
  for (const type of BOUNDARY_EVENTS) window.addEventListener(type, isolatePortals, true);
  return () => {
    observer.disconnect();
    document.removeEventListener("pointerup", update);
    document.removeEventListener("keyup", update);
    window.removeEventListener("scroll", clear, true);
    window.removeEventListener("resize", clear);
    for (const type of BOUNDARY_EVENTS) window.removeEventListener(type, isolatePortals, true);
    if (button.style.display === "none") button.style.display = oldDisplay;
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
