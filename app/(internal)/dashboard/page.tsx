import Link from "next/link";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { fetchDashboardData, fetchDashboardFinanceiro } from "@/lib/queries/contratos";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardFilters } from "./dashboard-filters";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    empresa?: string;
  }>;
}) {
  const params = await searchParams;
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const isEtax = sessao.isEtax;

  // Fetch workspaces for filter dropdown (Etax only)
  let workspaces: Array<{ id: string; nome: string; nome_fantasia: string | null }> = [];
  if (isEtax) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome, nome_fantasia")
      .eq("ativo", true)
      .order("nome");
    workspaces = data ?? [];
  }

  // Fetch operational data always; financial only for Etax
  const operacional = await fetchDashboardData(sessao);

  const {
    totalAtivos,
    aguardandoAssinatura,
    assinadosMes,
    aVencer30,
    aguardandoAprovacao,
    recentes,
    vencimentos,
  } = operacional;

  const now = new Date();

  // ─── CLIENT DASHBOARD ─────────────────────────────────
  if (!isEtax) {
    const clientKpis = [
      {
        label: "Contratos ativos",
        value: totalAtivos,
        color: "text-[var(--color-text)]",
        highlight: false,
      },
      {
        label: "Aguardando minha assinatura",
        value: aguardandoAssinatura,
        color: "text-[var(--color-status-warn)]",
        highlight: aguardandoAssinatura > 0,
      },
      {
        label: "Assinados no mês",
        value: assinadosMes,
        color: "text-[var(--color-status-ok)]",
        highlight: false,
      },
    ];

    return (
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)] mb-6">
          Dashboard
        </h1>

        {/* Client KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {clientKpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`etax-card ${kpi.highlight ? "border-l-4 border-[var(--color-status-warn)]" : ""}`}
              >
                <p className="text-xs text-[var(--color-text-mute)] uppercase tracking-wide mb-1">
                  {kpi.label}
                </p>
                <p className={`text-2xl font-semibold ${kpi.color}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* Contratos recentes */}
          <section>
            <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
              Contratos recentes
            </h2>

            {recentes.length === 0 ? (
              <div className="etax-card text-center py-8">
                <p className="text-sm text-[var(--color-text-mute)]">
                  Nenhum contrato ainda
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {recentes.map((c) => {
                  const contraparte = c.contraparte as unknown as { nome: string } | null;
                  return (
                    <Link
                      key={c.id}
                      href={`/contratos/${c.id}`}
                      className="etax-card py-3 hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {contraparte?.nome ?? "—"}
                        </p>
                        <StatusBadge status={c.status_assinatura} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                        <span className="capitalize">{c.tipo}</span>
                        {c.valor != null && (
                          <>
                            <span>·</span>
                            <span>{formatBRL(c.valor)}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {new Date(c.criado_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Vencimentos próximos */}
          <section>
            <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
              Vencimentos próximos
            </h2>

            {vencimentos.length === 0 ? (
              <div className="etax-card text-center py-8">
                <p className="text-sm text-[var(--color-text-mute)]">
                  Nenhum vencimento nos próximos 30 dias
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {vencimentos.map((c) => {
                  const contraparte = c.contraparte as unknown as { nome: string } | null;
                  const diasRestantes = Math.ceil(
                    (new Date(c.vigencia_fim).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const urgente = diasRestantes <= 7;

                  return (
                    <div
                      key={c.id}
                      className={`etax-card py-3 ${urgente ? "border-l-4 border-[var(--color-status-danger)]" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {contraparte?.nome ?? "—"}
                        </p>
                        <span
                          className={`text-xs font-semibold flex-shrink-0 ${
                            urgente
                              ? "text-[var(--color-status-danger)]"
                              : "text-[var(--color-status-warn)]"
                          }`}
                        >
                          {diasRestantes === 0
                            ? "Vence hoje"
                            : diasRestantes === 1
                              ? "Vence amanhã"
                              : `${diasRestantes} dias`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                        <span className="capitalize">{c.tipo}</span>
                        <span>·</span>
                        <span>
                          Vence em{" "}
                          {new Date(c.vigencia_fim).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ─── ETAX DASHBOARD ───────────────────────────────────

  const financeiro = await fetchDashboardFinanceiro(sessao, {
    mes: params.mes,
    workspaceId: params.empresa,
  });

  // Financial KPIs
  const financialKpis = [
    {
      label: "Receita líquida",
      value: formatBRL(financeiro.receitaLiquida),
      color: financeiro.receitaLiquida > 0
        ? "text-[var(--color-status-ok)]"
        : "text-[var(--color-text)]",
    },
    {
      label: "Receita bruta",
      value: formatBRL(financeiro.receitaBruta),
      color: "text-[var(--color-text)]",
    },
    {
      label: "Churn",
      value: financeiro.churn > 0 ? `- ${formatBRL(financeiro.churn)}` : formatBRL(0),
      color: financeiro.churn > 0
        ? "text-[var(--color-status-danger)]"
        : "text-[var(--color-text-mute)]",
    },
    {
      label: "Despesas",
      value: formatBRL(financeiro.despesaTotal),
      color: financeiro.despesaTotal > 0
        ? "text-[var(--color-status-warn)]"
        : "text-[var(--color-text-mute)]",
    },
  ];

  // Operational KPIs
  const operationalKpis = [
    { label: "Contratos ativos", value: totalAtivos, color: "text-[var(--color-text)]" },
    { label: "Aguardando assinatura", value: aguardandoAssinatura, color: "text-[var(--color-status-warn)]" },
    { label: "Assinados no mês", value: assinadosMes, color: "text-[var(--color-status-ok)]" },
    { label: "A vencer (30 dias)", value: aVencer30, color: aVencer30 > 0 ? "text-[var(--color-status-danger)]" : "text-[var(--color-text-mute)]" },
  ];

  // Format month label
  const [fYear, fMonth] = financeiro.mes.split("-").map(Number);
  const mesLabel = new Date(fYear, fMonth - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)] mb-6">
        Dashboard
      </h1>

      {/* Filters */}
      <DashboardFilters workspaces={workspaces} isEtax={isEtax} />

      {/* Financial KPIs */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
          Financeiro — {mesLabel}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {financialKpis.map((kpi) => (
            <div key={kpi.label} className="etax-card">
              <p className="text-xs text-[var(--color-text-mute)] uppercase tracking-wide mb-1">
                {kpi.label}
              </p>
              <p className={`text-xl font-semibold ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Per-empresa breakdown */}
      {financeiro.porEmpresa.length > 0 && !params.empresa && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
            Por empresa — {mesLabel}
          </h2>
          <div className="grid gap-2">
            {financeiro.porEmpresa.map((ws) => (
              <div key={ws.workspaceId} className="etax-card py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {ws.displayName}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  {ws.receita > 0 && (
                    <span className="text-[var(--color-status-ok)]">
                      Receita {formatBRL(ws.receita)}
                    </span>
                  )}
                  {ws.despesa > 0 && (
                    <span className="text-[var(--color-status-warn)]">
                      Despesa {formatBRL(ws.despesa)}
                    </span>
                  )}
                  {ws.churn > 0 && (
                    <span className="text-[var(--color-status-danger)]">
                      Churn {formatBRL(ws.churn)}
                    </span>
                  )}
                  {ws.receita === 0 && ws.despesa === 0 && ws.churn === 0 && (
                    <span className="text-[var(--color-text-mute)]">
                      Sem movimentação
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Operational KPIs */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
          Operacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {operationalKpis.map((kpi) => (
            <div key={kpi.label} className="etax-card">
              <p className="text-xs text-[var(--color-text-mute)] uppercase tracking-wide mb-1">
                {kpi.label}
              </p>
              <p className={`text-2xl font-semibold ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Aguardando aprovação — só Etax */}
      {aguardandoAprovacao > 0 && (
        <Link
          href="/confeccao"
          className="block etax-card mb-6 border-l-4 border-[var(--color-status-warn)] hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Aguardando aprovação
              </p>
              <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
                {aguardandoAprovacao} {aguardandoAprovacao === 1 ? "solicitação aguarda" : "solicitações aguardam"} aprovação
              </p>
            </div>
            <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-full bg-[var(--color-status-warn-bg)] text-[var(--color-status-warn)] text-sm font-bold">
              {aguardandoAprovacao}
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Contratos recentes */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
            Contratos recentes
          </h2>

          {recentes.length === 0 ? (
            <div className="etax-card text-center py-8">
              <p className="text-sm text-[var(--color-text-mute)]">
                Nenhum contrato ainda
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {recentes.map((c) => {
                const contraparte = c.contraparte as unknown as { nome: string } | null;
                const workspace = c.workspace as unknown as { id: string; nome: string; nome_fantasia: string | null } | null;

                return (
                  <Link
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    className="etax-card py-3 hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {contraparte?.nome ?? "—"}
                        </p>
                        {workspace && (
                          <p className="text-xs text-[var(--color-text-mute)] truncate">
                            {workspace.nome_fantasia || workspace.nome}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={c.status_assinatura} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                      <span className="capitalize">{c.tipo}</span>
                      {c.valor != null && (
                        <>
                          <span>·</span>
                          <span>{formatBRL(c.valor)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(c.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Vencimentos próximos */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
            Vencimentos próximos
          </h2>

          {vencimentos.length === 0 ? (
            <div className="etax-card text-center py-8">
              <p className="text-sm text-[var(--color-text-mute)]">
                Nenhum vencimento nos próximos 30 dias
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {vencimentos.map((c) => {
                const contraparte = c.contraparte as unknown as { nome: string } | null;
                const workspace = c.workspace as unknown as { id: string; nome: string; nome_fantasia: string | null } | null;
                const diasRestantes = Math.ceil(
                  (new Date(c.vigencia_fim).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );
                const urgente = diasRestantes <= 7;

                return (
                  <div
                    key={c.id}
                    className={`etax-card py-3 ${urgente ? "border-l-4 border-[var(--color-status-danger)]" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {contraparte?.nome ?? "—"}
                        </p>
                        {workspace && (
                          <p className="text-xs text-[var(--color-text-mute)] truncate">
                            {workspace.nome_fantasia || workspace.nome}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold flex-shrink-0 ${
                          urgente
                            ? "text-[var(--color-status-danger)]"
                            : "text-[var(--color-status-warn)]"
                        }`}
                      >
                        {diasRestantes === 0
                          ? "Vence hoje"
                          : diasRestantes === 1
                            ? "Vence amanhã"
                            : `${diasRestantes} dias`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                      <span className="capitalize">{c.tipo}</span>
                      <span>·</span>
                      <span>
                        Vence em{" "}
                        {new Date(c.vigencia_fim).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
