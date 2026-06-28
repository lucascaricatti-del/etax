import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ModelosList } from "./modelos-list";

export default async function ModelosPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isEtax) redirect("/solicitacoes");

  const supabase = createAdminClient();

  const [modelosRes, tiposRes, workspacesRes] = await Promise.all([
    supabase
      .from("modelos")
      .select("*, tipo_contrato:tipos_contrato(id, nome, slug), modelo_empresas(workspace_id)")
      .order("criado_em", { ascending: false }),
    supabase.from("tipos_contrato").select("id, nome, slug").eq("ativo", true).order("nome"),
    supabase.from("workspaces").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  console.log("[Modelos] page query:", {
    modelos: modelosRes.data?.length ?? 0,
    error: modelosRes.error?.message ?? null,
  });

  return (
    <ModelosList
      modelos={modelosRes.data ?? []}
      tiposContrato={tiposRes.data ?? []}
      workspaces={workspacesRes.data ?? []}
    />
  );
}
