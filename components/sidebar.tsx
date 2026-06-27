"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ETAX_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Empresas", href: "/empresas" },
  { label: "Solicitações", href: "/solicitacoes" },
  { label: "Confecção", href: "/confeccao" },
  { label: "Assinaturas", href: "/assinaturas" },
  { label: "Contratos", href: "/contratos" },
  { label: "Mentorados", href: "/mentorados" },
  { label: "Modelos", href: "/modelos" },
  { label: "Configurações", href: "/configuracoes" },
];

const CLIENTE_NAV = [
  { label: "Solicitações", href: "/solicitacoes" },
  { label: "Contratos", href: "/contratos" },
];

export function Sidebar({
  userName,
  isEtax,
}: {
  userName: string;
  isEtax: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = isEtax ? ETAX_NAV : CLIENTE_NAV;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col z-40">
      <div className="px-5 py-6 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">Etax Ops</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
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

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-white/60 truncate mb-2">{userName}</p>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-sidebar-hover)] transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
