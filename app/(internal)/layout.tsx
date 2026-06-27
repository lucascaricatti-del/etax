import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/sidebar";

export default async function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  // Count pending approvals for sidebar badge (Etax only)
  let pendingApprovals = 0;
  if (sessao.isEtax) {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("solicitacoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_aprovacao");
    pendingApprovals = count ?? 0;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        userName={sessao.profile?.nome ?? sessao.user.email ?? "Usuário"}
        isEtax={sessao.isEtax}
        isAdmin={sessao.isAdmin}
        pendingApprovals={pendingApprovals}
      />
      <main className="flex-1 ml-[var(--sidebar-width)] bg-[var(--color-bg)] min-h-screen">
        <div className="px-8 py-8 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
