"use client";

import { useState, useRef, useCallback } from "react";
import { HelpCircle } from "lucide-react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        onClick={toggle}
        className="etax-tooltip-trigger text-[var(--color-text-mute)] hover:text-[var(--color-text-soft)] transition-colors"
        aria-label="Ajuda"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-[var(--radius-btn)] bg-[var(--color-sidebar-bg)] text-white text-xs max-w-[200px] w-max z-50 text-center leading-relaxed pointer-events-none">
          {text}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-sidebar-bg)]" />
        </span>
      )}
    </span>
  );
}
