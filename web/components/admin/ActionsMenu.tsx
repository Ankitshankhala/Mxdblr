"use client";

/**
 * ActionsMenu — a button that opens a small dropdown of row actions.
 *
 * The menu is rendered into <body> at fixed coordinates next to its button,
 * because admin tables and card lists sit in containers with overflow hidden /
 * auto that would otherwise clip it (with one or two rows there is no room
 * below). It opens upward when space below is short, always stays inside the
 * window, and closes on a click elsewhere, Escape, scroll or resize, or once
 * an item is chosen.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ActionsMenuItem {
  label: string;
  onSelect: () => void;
  color?: string;
  bold?: boolean;
}

interface Anchor {
  right: number;
  top: number;
}

const ITEM_HEIGHT = 38;
const EDGE = 8; // keep the menu this far inside the window

export default function ActionsMenu({
  items,
  trigger,
  ariaLabel,
  buttonStyle,
}: {
  items: ActionsMenuItem[];
  trigger: ReactNode;
  ariaLabel: string;
  buttonStyle?: CSSProperties;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (anchor) { setAnchor(null); return; }
    const r = buttonRef.current!.getBoundingClientRect();
    const height = items.length * ITEM_HEIGHT + 2;
    const spaceBelow = window.innerHeight - r.bottom;
    const wanted = spaceBelow < height + EDGE && r.top > spaceBelow ? r.top - 4 - height : r.bottom + 4;
    setAnchor({
      right: Math.max(EDGE, window.innerWidth - r.right),
      top: Math.max(EDGE, Math.min(wanted, window.innerHeight - height - EDGE)),
    });
  }

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); buttonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={ariaLabel}
        style={buttonStyle}
      >
        {trigger}
      </button>
      {anchor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed", right: anchor.right, top: anchor.top,
            background: "#fff", border: "1px solid #E8E4DE", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 900, minWidth: 160, overflow: "hidden",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setAnchor(null); item.onSelect(); }}
              style={{
                display: "block", width: "100%", padding: "9px 14px", border: "none", background: "none",
                textAlign: "left", fontSize: 13, cursor: "pointer",
                fontWeight: item.bold ? 600 : 400, color: item.color ?? "#1F1813",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
