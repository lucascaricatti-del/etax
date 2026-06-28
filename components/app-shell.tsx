"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { MobileHeader } from "./mobile-header";
import { Sidebar } from "./sidebar";

export function AppShell({
  children,
  userName,
  isEtax,
  isAdmin,
  pendingApprovals,
}: {
  children: React.ReactNode;
  userName: string;
  isEtax: boolean;
  isAdmin: boolean;
  pendingApprovals: number;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Block body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <>
      {/* Mobile header */}
      <MobileHeader onMenuToggle={toggleDrawer} />

      {/* Overlay — mobile only */}
      <div
        className="etax-overlay lg:hidden"
        data-open={drawerOpen}
        onClick={closeDrawer}
      />

      {/* Sidebar container */}
      <div
        className={`fixed left-0 top-0 h-screen w-[var(--sidebar-width)] z-40 transition-transform duration-200 ease-in-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Close button — mobile only */}
        <button
          onClick={closeDrawer}
          className="absolute top-3 right-3 z-50 flex items-center justify-center w-8 h-8 text-[var(--color-sidebar-text)] hover:text-[var(--color-sidebar-text-bright)] lg:hidden"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>

        <Sidebar
          userName={userName}
          isEtax={isEtax}
          isAdmin={isAdmin}
          pendingApprovals={pendingApprovals}
        />
      </div>

      {/* Main content */}
      <main className="lg:ml-[var(--sidebar-width)] bg-[var(--color-bg)] min-h-screen pt-14 lg:pt-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1200px]">
          {children}
        </div>
      </main>
    </>
  );
}
