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
      "*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*), workspace:workspaces(id, nome, nome_fantasia)"
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
  let workspaces: Array<{ id: string; nome: string; nome_fantasia: string | null }> = [];
  if (sessao?.isEtax) {
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome, nome_fantasia")
      .eq("ativo", true)
      .order("nome");
    workspaces = data ?? [];
  }

  const items = (solicitacoes ?? []) as unknown as (SolicitacaoComDetalhes & {
    workspace?: { id: string; nome: string; nome_fantasia: string | null } | null;
  })[];

  // Resolve defaultWorkspaceId for cliente
  const defaultWorkspaceId = sessao?.isEtax
    ? null
    : sessao?.workspaceIds[0] ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Solicitações
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-mute)]">
          Acompanhamento de solicitações de contrato
        </p>
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

      {/* Desktop table */}
      <div className="etax-card mt-4 overflow-x-auto p-0 hidden sm:block">
        <table className="etax-table">
          <thead>
            <tr>
              <th>Contraparte</th>
              {sessao?.isEtax && <th>Empresa</th>}
              <th>Tipo</th>
              <th>Status</th>
              <th>Data</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={sessao?.isEtax ? 6 : 5}
                  className="!text-center !py-8 text-[var(--color-text-mute)]"
                >
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.contraparte?.nome ?? "—"}</td>
                  {sessao?.isEtax && (
                    <td className="text-[var(--color-text-soft)]">
                      {s.workspace?.nome_fantasia || s.workspace?.nome || "—"}
                    </td>
                  )}
                  <td className="text-[var(--color-text-soft)]">
                    {s.tipo_contrato?.nome ?? "—"}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="text-[var(--color-text-soft)]">
                    {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/solicitacoes/${s.id}`}
                      className="text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
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

      {/* Mobile cards */}
      <div className="sm:hidden mt-4 grid gap-2">
        {items.length === 0 ? (
          <div className="etax-card text-center py-8">
            <p className="text-sm text-[var(--color-text-mute)]">
              Nenhuma solicitação encontrada.
            </p>
          </div>
        ) : (
          items.map((s) => (
            <Link
              key={s.id}
              href={`/solicitacoes/${s.id}`}
              className="etax-card py-3 hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {s.contraparte?.nome ?? "—"}
                </p>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                <span>{s.tipo_contrato?.nome ?? "—"}</span>
                <span>·</span>
                <span>{new Date(s.criado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
