"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Solicitações", href: "/solicitacoes" },
  { label: "Confecção", href: "/confeccao" },
  { label: "Assinaturas", href: "/assinaturas" },
  { label: "Contratos", href: "/contratos" },
  { label: "Mentorados", href: "/mentorados" },
  { label: "Modelos", href: "/modelos" },
  { label: "Configurações", href: "/configuracoes" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col z-40">
      <div className="px-5 py-6 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">Etax Ops</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-sidebar-active)] text-white"
                      : "hover:bg-[var(--color-sidebar-hover)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
