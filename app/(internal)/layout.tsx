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

  const supabase = createAdminClient();

  // Count pending approvals for sidebar badge (Etax only)
  let pendingApprovals = 0;
  if (sessao.isEtax) {
    const { count } = await supabase
      .from("solicitacoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_aprovacao");
    pendingApprovals = count ?? 0;
  }

  // Company name for the sidebar (cliente view only)
  let workspaceName: string | null = null;
  if (!sessao.isEtax && sessao.workspaceIds.length > 0) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("nome, nome_fantasia")
      .eq("id", sessao.workspaceIds[0])
      .maybeSingle();
    workspaceName = workspace?.nome_fantasia || workspace?.nome || null;
  }

  return (
    <AppShell
      userName={sessao.profile?.nome ?? sessao.user.email ?? "Usuário"}
      isEtax={sessao.isEtax}
      isAdmin={sessao.isAdmin}
      pendingApprovals={pendingApprovals}
      workspaceName={workspaceName}
    >
      {children}
    </AppShell>
  );
}
