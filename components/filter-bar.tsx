"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export function FilterBar({
  children,
  onClear,
  hasActiveFilters,
}: {
  children: React.ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mb-4">
      {/* Mobile toggle */}
      <div className="sm:hidden mb-2">
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="etax-btn etax-btn-ghost text-sm relative"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--color-status-warn)]" />
          )}
        </button>
      </div>

      {/* Filters — always visible on desktop, toggled on mobile */}
      <div className={`${mobileOpen ? "flex" : "hidden"} sm:flex etax-filter-bar`}>
        {children}
        {hasActiveFilters && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-mute)] hover:text-[var(--color-text)] transition-colors min-h-[40px] px-2"
          >
            <X size={14} />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
