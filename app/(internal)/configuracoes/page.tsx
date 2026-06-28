import { getSessao } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfigAssinatura } from "./config-assinatura";

export default async function ConfiguracoesPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isAdmin) redirect("/dashboard");

  const supabase = createAdminClient();

  // Fetch workspaces + existing configs in parallel
  const [wsResult, configResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, nome, nome_fantasia")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("workspace_clicksign_config")
      .select("*")
      .order("criado_em", { ascending: false }),
  ]);

  const workspaces = wsResult.data ?? [];
  const configs = configResult.data ?? [];

  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)] mb-6">
        Configurações
      </h1>

      <ConfigAssinatura workspaces={workspaces} configs={configs} />
    </div>
  );
}
