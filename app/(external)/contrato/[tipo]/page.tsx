import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import type { TipoContrato } from "@/lib/types";
import { ContratoForm } from "./contrato-form";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const { tipo: slug } = await params;
  const supabase = createAdminClient();

  const { data: tipo } = await supabase
    .from("tipos_contrato")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();

  if (!tipo) notFound();

  const tipoContrato = tipo as TipoContrato;

  // Resolve workspace info
  let workspaces: Array<{ id: string; nome: string }> = [];
  let defaultWorkspaceId: string | null = null;

  if (sessao.isEtax) {
    // Etax: fetch all workspaces for selector
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    workspaces = data ?? [];
  } else {
    // Cliente: auto-use their workspace
    defaultWorkspaceId = sessao.workspaceIds[0] ?? null;
  }

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)] mb-2">
        Solicitação de Contrato — {tipoContrato.nome}
      </h1>
      <p className="text-[var(--color-text-soft)] mb-8">
        Preencha os dados abaixo para solicitar a confecção do contrato.
      </p>
      <ContratoForm
        tipoContrato={tipoContrato}
        isEtax={sessao.isEtax}
        workspaces={workspaces}
        defaultWorkspaceId={defaultWorkspaceId}
      />
    </>
  );
}
