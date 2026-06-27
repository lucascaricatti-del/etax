import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import type { SolicitacaoComDetalhes } from "@/lib/types";
import { Filters } from "./filters";
import { NovaSolicitacaoForm } from "./nova-solicitacao-form";

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string; empresa?: string }>;
}) {
  const { tipo, status, empresa } = await searchParams;
  const sessao = await getSessao();
  const supabase = createAdminClient();

  let query = supabase
    .from("solicitacoes")
    .select(
      "*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*), workspace:workspaces(id, nome)"
    )
    .order("criado_em", { ascending: false });

  // Scope by workspace
  if (sessao?.isEtax) {
    // Etax: optionally filter by empresa
    if (empresa) {
      query = query.eq("workspace_id", empresa);
    }
  } else {
    // Cliente: only their workspace(s)
    const ids = sessao?.workspaceIds ?? [];
    if (ids.length > 0) {
      query = query.in("workspace_id", ids);
    } else {
      query = query.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  if (tipo) {
    query = query.eq("tipo_contrato_id", tipo);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: solicitacoes } = await query;

  // Fetch tipos for filter dropdown + form fields
  const { data: tipos } = await supabase
    .from("tipos_contrato")
    .select("id, nome, schema_campos")
    .eq("ativo", true)
    .order("nome");

  // Fetch workspaces for empresa filter (etax only)
  let workspaces: Array<{ id: string; nome: string }> = [];
  if (sessao?.isEtax) {
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    workspaces = data ?? [];
  }

  const items = (solicitacoes ?? []) as unknown as (SolicitacaoComDetalhes & {
    workspace?: { id: string; nome: string } | null;
  })[];

  // Resolve defaultWorkspaceId for cliente
  const defaultWorkspaceId = sessao?.isEtax
    ? null
    : sessao?.workspaceIds[0] ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Solicitações</h1>
      </div>

      <NovaSolicitacaoForm
        tipos={(tipos ?? []) as Array<{ id: string; nome: string; schema_campos: import("@/lib/types").CampoSchema[] }>}
        workspaces={workspaces}
        isEtax={sessao?.isEtax ?? false}
        defaultWorkspaceId={defaultWorkspaceId}
      />

      <div className="mt-4" />

      <Filters
        tipos={tipos ?? []}
        tipoAtual={tipo}
        statusAtual={status}
        isEtax={sessao?.isEtax ?? false}
        workspaces={workspaces}
        empresaAtual={empresa}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contraparte
              </th>
              {sessao?.isEtax && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Empresa
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={sessao?.isEtax ? 6 : 5}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.contraparte?.nome ?? "—"}
                  </td>
                  {sessao?.isEtax && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {s.workspace?.nome ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.tipo_contrato?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/solicitacoes/${s.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
