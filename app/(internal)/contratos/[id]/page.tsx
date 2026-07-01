import Link from "next/link";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContratoAdminActions } from "./contrato-admin-actions";

const NATUREZA_LABELS: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
  neutro: "Neutro",
};

const NATUREZA_COLORS: Record<string, string> = {
  receita: "text-[var(--color-status-ok)] bg-[var(--color-status-ok-bg)]",
  despesa: "text-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)]",
  neutro: "text-[var(--color-status-info)] bg-[var(--color-status-info-bg)]",
};

export default async function ContratoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const supabase = createAdminClient();

  const { data: contrato, error } = await supabase
    .from("contratos")
    .select(
      `id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim,
       assinado_em, criado_em, pdf_assinado_path, workspace_id, natureza_documento,
       contrato_pai_id, conta_no_dashboard, data_distrato, valor_distrato,
       excluido_em, excluido_por, modelo_id, clicksign_envelope_id,
       contraparte:contrapartes(id, nome, cpf_cnpj),
       workspace:workspaces(id, nome, nome_fantasia),
       modelo:modelos(id, nome, natureza_financeira, versao)`
    )
    .eq("id", id)
    .single();

  if (error || !contrato) {
    redirect("/contratos");
  }

  // Scope check for clients: só acessa se workspace_id não-nulo E pertencer ao usuário
  if (!sessao.isEtax) {
    if (!contrato.workspace_id || !sessao.workspaceIds.includes(contrato.workspace_id)) {
      redirect("/contratos");
    }
  }

  const contraparte = contrato.contraparte as unknown as {
    id: string;
    nome: string;
    cpf_cnpj: string;
  } | null;
  const workspace = contrato.workspace as unknown as {
    id: string;
    nome: string;
    nome_fantasia: string | null;
  } | null;
  const modelo = contrato.modelo as unknown as {
    id: string;
    nome: string;
    natureza_financeira: string;
    versao: number;
  } | null;

  const isExcluido = !!contrato.excluido_em;
  const isDistratado = contrato.status_assinatura === "distratado";
  const isAditivo = contrato.natureza_documento === "aditivo";

  // Fetch related data in parallel (all depend on contrato but not on each other)
  const [paisResult, paiResult, aditivosResult] = await Promise.all([
    // Possible parent contracts for "marcar como aditivo" (admin only)
    sessao.isAdmin && contrato.natureza_documento === "principal"
      ? supabase
          .from("contratos")
          .select("id, tipo, contraparte:contrapartes(nome)")
          .eq("workspace_id", contrato.workspace_id)
          .eq("natureza_documento", "principal")
          .eq("status_assinatura", "assinado")
          .is("excluido_em", null)
          .neq("id", contrato.id)
          .order("criado_em", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),

    // Parent contrato if aditivo
    isAditivo && contrato.contrato_pai_id
      ? supabase
          .from("contratos")
          .select("id, tipo, contraparte:contrapartes(nome)")
          .eq("id", contrato.contrato_pai_id)
          .single()
      : Promise.resolve({ data: null }),

    // Child aditivos if principal
    contrato.natureza_documento === "principal"
      ? supabase
          .from("contratos")
          .select("id, tipo, valor, criado_em, status_assinatura, contraparte:contrapartes(nome)")
          .eq("contrato_pai_id", contrato.id)
          .is("excluido_em", null)
          .order("criado_em", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const possiveisPais = (paisResult.data ?? []).map((p) => {
    const cp = (p as { contraparte: unknown }).contraparte as { nome: string } | null;
    return {
      id: (p as { id: string }).id,
      label: `${cp?.nome ?? "—"} — ${(p as { tipo: string }).tipo}`,
    };
  });

  let contratoPai: { id: string; tipo: string; contraparte_nome: string } | null = null;
  if (paiResult.data) {
    const pai = paiResult.data as { id: string; tipo: string; contraparte: unknown };
    const cpPai = pai.contraparte as { nome: string } | null;
    contratoPai = {
      id: pai.id,
      tipo: pai.tipo,
      contraparte_nome: cpPai?.nome ?? "—",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aditivos: any[] = aditivosResult.data ?? [];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/contratos"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4"
      >
        &larr; Voltar aos contratos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--color-text)]">
            {contraparte?.nome ?? "Contrato"}
          </h1>
          {sessao.isEtax && workspace && (
            <p className="text-sm text-[var(--color-text-mute)] mt-0.5">
              {workspace.nome_fantasia || workspace.nome}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <StatusBadge status={contrato.status_assinatura} />
          {contrato.status_vigencia && contrato.status_assinatura === "assinado" && (
            <StatusBadge status={contrato.status_vigencia} />
          )}
          {isAditivo && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--color-status-info)] bg-[var(--color-status-info-bg)]">
              Aditivo
            </span>
          )}
        </div>
      </div>

      {/* Excluido banner — Etax only */}
      {sessao.isEtax && isExcluido && (
        <div className="etax-card mb-4 border-l-4 border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)]">
          <p className="text-sm font-medium text-[var(--color-status-danger)]">
            Contrato excluído
          </p>
          <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
            Este contrato foi excluído e não aparece nos cálculos.
          </p>
        </div>
      )}

      {/* Dashboard exclusion notice — Etax only */}
      {sessao.isEtax && !contrato.conta_no_dashboard && !isExcluido && (
        <div className="etax-card mb-4 border-l-4 border-[var(--color-status-warn)] bg-[var(--color-status-warn-bg)]">
          <p className="text-sm font-medium text-[var(--color-status-warn)]">
            Excluído do dashboard
          </p>
          <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
            Este contrato não é contabilizado nos KPIs financeiros.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Info card */}
        <div className="etax-card space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide">
            Informações
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-soft)]">Contraparte</span>
              <span className="text-[var(--color-text)] font-medium">
                {contraparte?.nome ?? "—"}
              </span>
            </div>
            {contraparte?.cpf_cnpj && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-soft)]">CPF/CNPJ</span>
                <span className="text-[var(--color-text)] font-mono text-xs">
                  {contraparte.cpf_cnpj}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--color-text-soft)]">Tipo</span>
              <span className="text-[var(--color-text)] capitalize">{contrato.tipo}</span>
            </div>
            {contrato.valor != null && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-soft)]">Valor</span>
                <span className="text-[var(--color-text)] font-semibold">
                  {formatBRL(contrato.valor)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--color-text-soft)]">Natureza</span>
              <span className="text-[var(--color-text)] capitalize">
                {contrato.natureza_documento}
              </span>
            </div>
            {modelo && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-soft)]">Modelo</span>
                  <span className="text-[var(--color-text)]">
                    {modelo.nome ?? `v${modelo.versao}`}
                  </span>
                </div>
                {sessao.isEtax && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-soft)]">Natureza financeira</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${NATUREZA_COLORS[modelo.natureza_financeira] ?? NATUREZA_COLORS.neutro}`}
                    >
                      {NATUREZA_LABELS[modelo.natureza_financeira] ?? modelo.natureza_financeira}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Dates card */}
        <div className="etax-card space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide">
            Datas
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-soft)]">Criado em</span>
              <span className="text-[var(--color-text)]">
                {new Date(contrato.criado_em).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {contrato.assinado_em && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-soft)]">Assinado em</span>
                <span className="text-[var(--color-text)]">
                  {new Date(contrato.assinado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
            {contrato.vigencia_inicio && contrato.vigencia_fim && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-soft)]">Vigência</span>
                <span className="text-[var(--color-text)]">
                  {new Date(contrato.vigencia_inicio).toLocaleDateString("pt-BR")} —{" "}
                  {new Date(contrato.vigencia_fim).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
            {isDistratado && contrato.data_distrato && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-soft)]">Data do distrato</span>
                  <span className="text-[var(--color-status-danger)] font-medium">
                    {new Date(contrato.data_distrato + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {contrato.valor_distrato != null && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-soft)]">Valor do distrato</span>
                    <span className="text-[var(--color-status-danger)] font-semibold">
                      {formatBRL(contrato.valor_distrato)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* PDF link */}
          {contrato.pdf_assinado_path && (
            <a
              href={`/api/contratos/${contrato.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline font-medium mt-2"
            >
              Baixar PDF assinado
            </a>
          )}
        </div>
      </div>

      {/* Parent contrato link (if aditivo) */}
      {isAditivo && contratoPai && (
        <div className="etax-card mt-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-2">
            Contrato principal
          </h2>
          <Link
            href={`/contratos/${contratoPai.id}`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {contratoPai.contraparte_nome} — {contratoPai.tipo}
          </Link>
        </div>
      )}

      {/* Child aditivos */}
      {aditivos.length > 0 && (
        <div className="etax-card mt-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
            Aditivos ({aditivos.length})
          </h2>
          <div className="space-y-2">
            {aditivos.map((a) => {
              const cp = a.contraparte as unknown as { nome: string } | null;
              return (
                <Link
                  key={a.id}
                  href={`/contratos/${a.id}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-[var(--radius-btn)] hover:bg-[var(--color-bg)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text)] truncate">
                      {cp?.nome ?? "—"} — {a.tipo}
                    </p>
                    <p className="text-xs text-[var(--color-text-soft)]">
                      {new Date(a.criado_em).toLocaleDateString("pt-BR")}
                      {a.valor != null && ` · ${formatBRL(a.valor)}`}
                    </p>
                  </div>
                  <StatusBadge status={a.status_assinatura} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin actions */}
      {sessao.isAdmin && (
        <div className="etax-card mt-4">
          <ContratoAdminActions
            contrato={{
              id: contrato.id,
              status_assinatura: contrato.status_assinatura,
              natureza_documento: contrato.natureza_documento,
              conta_no_dashboard: contrato.conta_no_dashboard,
              contrato_pai_id: contrato.contrato_pai_id,
              excluido_em: contrato.excluido_em,
              workspace_id: contrato.workspace_id,
            }}
            possiveisPais={possiveisPais}
          />
        </div>
      )}
    </div>
  );
}
