import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";

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
    <AppShell
      userName={sessao.profile?.nome ?? sessao.user.email ?? "Usuário"}
      isEtax={sessao.isEtax}
      isAdmin={sessao.isAdmin}
      pendingApprovals={pendingApprovals}
    >
      {children}
    </AppShell>
  );
}
