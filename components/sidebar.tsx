"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Hammer,
  PenTool,
  Files,
  Users,
  FileBox,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const ETAX_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Empresas", href: "/empresas", icon: Building2 },
  { label: "Solicitações", href: "/solicitacoes", icon: FileText },
  { label: "Confecção", href: "/confeccao", icon: Hammer },
  { label: "Assinaturas", href: "/assinaturas", icon: PenTool },
  { label: "Contratos", href: "/contratos", icon: Files },
  { label: "Mentorados", href: "/mentorados", icon: Users },
  { label: "Modelos", href: "/modelos", icon: FileBox },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

const CLIENTE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Meus Contratos", href: "/contratos", icon: Files },
  { label: "Minhas Solicitações", href: "/solicitacoes", icon: FileText },
];

export function Sidebar({
  userName,
  isEtax,
  isAdmin,
  pendingApprovals,
}: {
  userName: string;
  isEtax: boolean;
  isAdmin: boolean;
  pendingApprovals: number;
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

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside className="h-full w-full bg-[var(--color-sidebar-bg)] flex flex-col">
      {/* Logo + tagline */}
      <div className="px-6 pt-7 pb-6 border-b border-[var(--color-sidebar-line)]">
        <Image
          src="/LOGO ETAX PNG-07.png"
          alt="E-TAX"
          width={100}
          height={40}
          className="h-8 w-auto brightness-0 invert"
          priority
        />
        <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-sidebar-text)]">
          Consultoria Tributária Empresarial
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-[var(--radius-btn)] text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-white text-[var(--color-sidebar-bg)]"
                      : "text-[var(--color-sidebar-text)] hover:text-[var(--color-sidebar-text-bright)] hover:bg-[var(--color-sidebar-card)]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  {item.href === "/confeccao" && pendingApprovals > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-status-warning)] text-[10px] font-bold text-white">
                      {pendingApprovals}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[var(--color-sidebar-line)]">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-sidebar-card)] border border-[var(--color-sidebar-line)] flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--color-sidebar-text)]">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--color-sidebar-text-bright)] truncate">
              {userName}
            </p>
            <p className="text-[11px] text-[var(--color-sidebar-text)]">
              {isEtax ? (isAdmin ? "Etax · Admin" : "Etax") : "Cliente"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[11px] font-medium text-[var(--color-sidebar-text)] hover:text-white transition-colors"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
