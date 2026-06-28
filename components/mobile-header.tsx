"use client";

import Image from "next/image";
import { Menu } from "lucide-react";

export function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[var(--color-sidebar-bg)] z-50 flex items-center justify-between px-4 lg:hidden">
      <Image
        src="/LOGO ETAX PNG-07.png"
        alt="E-TAX"
        width={80}
        height={32}
        className="h-6 w-auto brightness-0 invert"
        priority
      />
      <button
        onClick={onMenuToggle}
        className="flex items-center justify-center w-11 h-11 text-[var(--color-sidebar-text-bright)]"
        aria-label="Abrir menu"
      >
        <Menu size={24} />
      </button>
    </header>
  );
}
