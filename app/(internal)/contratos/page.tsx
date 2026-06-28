import Link from "next/link";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { fetchContratos } from "@/lib/queries/contratos";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContratosFilters } from "./contratos-filters";

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{
    empresa?: string;
    tipo?: string;
    status?: string;
    mes?: string;
    busca?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;

  const { data: contratos, count } = await fetchContratos(sessao, {
    workspaceId: params.empresa,
    tipo: params.tipo,
    statusAssinatura: params.status,
    mes: params.mes,
    busca: params.busca,
    page,
    pageSize,
  });

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Fetch workspaces for filter dropdown (Etax only)
  const supabase = createAdminClient();
  let workspaces: Array<{
    id: string;
    nome: string;
    nome_fantasia: string | null;
  }> = [];
  if (sessao.isEtax) {
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome, nome_fantasia")
      .eq("ativo", true)
      .order("nome");
    workspaces = data ?? [];
  }

  // Fetch distinct tipos for filter
  const { data: tiposData } = await supabase
    .from("contratos")
    .select("tipo");
  const tipos = [
    ...new Set((tiposData ?? []).map((t) => t.tipo).filter(Boolean)),
  ].sort();

  const viewMode = params.view || "lista";
  const isGrouped = viewMode === "agrupado" && sessao.isEtax;

  // Group by workspace if needed
  const grouped = isGrouped
    ? groupByWorkspace(contratos ?? [])
    : null;

  const hasFilters =
    params.busca ||
    params.empresa ||
    params.tipo ||
    params.status ||
    params.mes;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)]">
            Contratos
          </h1>
          <p className="text-sm text-[var(--color-text-mute)] mt-1">
            {total} {total === 1 ? "contrato" : "contratos"}
            {hasFilters ? " (filtrado)" : ""}
          </p>
        </div>
      </div>

      <ContratosFilters
        workspaces={workspaces}
        tipos={tipos}
        isEtax={sessao.isEtax}
      />

      {total === 0 ? (
        <div className="etax-card text-center py-8">
          <p className="text-sm text-[var(--color-text-mute)]">
            Nenhum contrato encontrado
          </p>
        </div>
      ) : isGrouped && grouped ? (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.workspaceId}>
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  {group.displayName}
                </h2>
                {group.razaoSocial && group.razaoSocial !== group.displayName && (
                  <span className="text-xs text-[var(--color-text-mute)]">
                    {group.razaoSocial}
                  </span>
                )}
                <span className="text-xs text-[var(--color-text-mute)]">
                  ({group.contratos.length})
                </span>
              </div>
              <div className="grid gap-3">
                {group.contratos.map((c) => (
                  <ContratoCard
                    key={c.id}
                    contrato={c}
                    showEmpresa={false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {(contratos ?? []).map((c) => (
            <ContratoCard
              key={c.id}
              contrato={c}
              showEmpresa={sessao.isEtax}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 gap-2">
          <PaginationLink
            page={page - 1}
            disabled={page <= 1}
            label="Anterior"
            params={params}
          />
          <span className="text-sm text-[var(--color-text-mute)]">
            Página {page} de {totalPages}
          </span>
          <PaginationLink
            page={page + 1}
            disabled={page >= totalPages}
            label="Próximo"
            params={params}
          />
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function ContratoCard({
  contrato: c,
  showEmpresa,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contrato: any;
  showEmpresa: boolean;
}) {
  const contraparte = c.contraparte as unknown as {
    nome: string;
    cpf_cnpj: string;
  } | null;
  const workspace = c.workspace as unknown as {
    id: string;
    nome: string;
    nome_fantasia: string | null;
  } | null;

  return (
    <div className="etax-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--color-text)] truncate">
            {contraparte?.nome ?? "—"}
          </p>
          {showEmpresa && workspace && (
            <p className="text-xs text-[var(--color-text-mute)] truncate mt-0.5">
              {workspace.nome_fantasia || workspace.nome}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <StatusBadge status={c.status_assinatura} />
          {c.status_vigencia && c.status_assinatura === "assinado" && (
            <StatusBadge status={c.status_vigencia} />
          )}
        </div>
      </div>

      <div className="space-y-1 text-xs text-[var(--color-text-soft)]">
        <div className="flex justify-between">
          <span className="capitalize">{c.tipo}</span>
          {c.valor != null && (
            <span className="font-medium text-[var(--color-text)]">
              {formatBRL(c.valor)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {contraparte?.cpf_cnpj && (
            <>
              <span className="font-mono">{contraparte.cpf_cnpj}</span>
              <span>·</span>
            </>
          )}
          <span>
            {new Date(c.criado_em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
          {c.assinado_em && (
            <>
              <span>·</span>
              <span>
                Assinado{" "}
                {new Date(c.assinado_em).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </>
          )}
        </div>

        {c.vigencia_inicio && c.vigencia_fim && (
          <p>
            Vigência:{" "}
            {new Date(c.vigencia_inicio).toLocaleDateString("pt-BR")} —{" "}
            {new Date(c.vigencia_fim).toLocaleDateString("pt-BR")}
          </p>
        )}

        {c.pdf_assinado_path && (
          <a
            href={`/api/contratos/${c.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
          >
            Baixar PDF assinado
          </a>
        )}
      </div>
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  label,
  params,
}: {
  page: number;
  disabled: boolean;
  label: string;
  params: Record<string, string | undefined>;
}) {
  if (disabled) {
    return (
      <span className="etax-btn etax-btn-ghost min-h-[48px] opacity-50 pointer-events-none">
        {label}
      </span>
    );
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") searchParams.set(key, value);
  }
  searchParams.set("page", String(page));

  return (
    <Link
      href={`/contratos?${searchParams.toString()}`}
      className="etax-btn etax-btn-ghost min-h-[48px]"
    >
      {label}
    </Link>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByWorkspace(contratos: any[]) {
  const groups = new Map<
    string,
    {
      workspaceId: string;
      displayName: string;
      razaoSocial: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contratos: any[];
    }
  >();

  for (const c of contratos) {
    const wsId = c.workspace_id ?? "sem-empresa";
    const ws = c.workspace as unknown as {
      id: string;
      nome: string;
      nome_fantasia: string | null;
    } | null;

    if (!groups.has(wsId)) {
      groups.set(wsId, {
        workspaceId: wsId,
        displayName: ws?.nome_fantasia || ws?.nome || "Sem empresa",
        razaoSocial: ws?.nome || "Sem empresa",
        contratos: [],
      });
    }
    groups.get(wsId)!.contratos.push(c);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}
