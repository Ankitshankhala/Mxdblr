"use client";

/**
 * Keyboard behaviour for admin popups (modals):
 * - Escape closes the popup.
 * - Tab / Shift+Tab cycle through the popup's controls and never leave it.
 * - On open, focus moves into the popup: to an element marked
 *   `data-autofocus`, else to the popup box itself (so a phone keyboard doesn't
 *   pop up uninvited). On close, focus returns to whatever opened it.
 * - Only the top-most open popup reacts, so a confirm opened over another
 *   popup closes on its own.
 *
 * Usage:
 *   const dialogRef = useDialog(open, close);
 *   {open && <div ...overlay><div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>…}
 */
import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Open popups, innermost last. Only the last one handles keys.
const openDialogs: HTMLElement[] = [];

export function useDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  // Latest onClose without re-running the open/close effect on every render
  // (which would keep stealing focus back to the top of the popup).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(dialog);

    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog!.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // The popup box itself counts as "before the first control".
      const atStart = active === first || active === dialog || !dialog!.contains(active);
      const atEnd = active === last || !dialog!.contains(active);
      if (e.shiftKey && atStart) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && atEnd) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  return ref;
}
