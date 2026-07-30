import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFinanceiroPeriodo } from "@/lib/queries/contratos";
import { formatBRL } from "@/lib/format";
import { FinanceiroFilters } from "./financeiro-filters";

// Visão financeira do CLIENTE — receita/churn/despesas do próprio workspace
// por período (intervalo de meses), com evolução mensal e breakdown por tipo.
// Mesma regra de inclusão do dashboard financeiro Etax.
// Etax acompanha o financeiro consolidado no /dashboard.

function mesLabel(mes: string, opts?: { short?: boolean }): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  if (opts?.short) {
    const s = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return `${s}/${String(y).slice(2)}`;
  }
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; tipo?: string }>;
}) {
  const params = await searchParams;
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  // Etax tem o financeiro consolidado no dashboard
  if (sessao.isEtax) redirect("/dashboard");
  if (sessao.workspaceIds.length === 0) redirect("/dashboard");

  const supabase = createAdminClient();

  const [fin, tiposResult] = await Promise.all([
    fetchFinanceiroPeriodo(sessao, {
      de: params.de,
      ate: params.ate,
      tipo: params.tipo,
    }),
    supabase
      .from("contratos")
      .select("tipo")
      .in("workspace_id", sessao.workspaceIds)
      .is("excluido_em", null),
  ]);

  const tipos = [
    ...new Set((tiposResult.data ?? []).map((t) => t.tipo).filter(Boolean)),
  ].sort() as string[];

  const kpis = [
    {
      label: "Receita bruta",
      value: formatBRL(fin.receitaBruta),
      hint: "Contratos assinados no período",
      color: "text-[var(--color-text)]",
    },
    {
      label: "Churn",
      value: fin.churn > 0 ? `- ${formatBRL(fin.churn)}` : formatBRL(0),
      hint: "Distratos no período",
      color:
        fin.churn > 0
          ? "text-[var(--color-status-danger)]"
          : "text-[var(--color-text-mute)]",
    },
    {
      label: "Receita líquida",
      value: formatBRL(fin.receitaLiquida),
      hint: "Receita bruta - churn",
      color:
        fin.receitaLiquida > 0
          ? "text-[var(--color-status-ok)]"
          : "text-[var(--color-text)]",
    },
    {
      label: "Despesas",
      value: formatBRL(fin.despesaTotal),
      hint: "Contratos de despesa assinados",
      color:
        fin.despesaTotal > 0
          ? "text-[var(--color-status-warn)]"
          : "text-[var(--color-text-mute)]",
    },
    {
      label: "Contratos assinados",
      value: String(fin.qtdAssinados),
      hint:
        fin.qtdDistratos > 0
          ? `${fin.qtdDistratos} ${fin.qtdDistratos === 1 ? "distrato" : "distratos"} no período`
          : "Contratos de receita",
      color: "text-[var(--color-text)]",
    },
    {
      label: "Ticket médio",
      value: formatBRL(fin.ticketMedio),
      hint: "Receita bruta ÷ contratos",
      color: "text-[var(--color-text)]",
    },
  ];

  // Escala do gráfico: maior valor mensal entre receita, despesa e churn
  const maxMensal = Math.max(
    1,
    ...fin.meses.map((m) => Math.max(m.receita, m.despesa, m.churn))
  );

  const periodoLabel =
    fin.de === fin.ate
      ? mesLabel(fin.de)
      : `${mesLabel(fin.de)} a ${mesLabel(fin.ate)}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Financeiro
        </h1>
        <p className="text-sm text-[var(--color-text-mute)] mt-1">
          Resultado dos seus contratos — {periodoLabel}
        </p>
      </div>

      <FinanceiroFilters de={fin.de} ate={fin.ate} tipos={tipos} />

      {/* KPIs do período */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="etax-card">
              <p className="text-xs text-[var(--color-text-mute)] uppercase tracking-wide mb-1">
                {kpi.label}
              </p>
              <p className={`text-xl font-semibold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[11px] text-[var(--color-text-mute)] mt-0.5">
                {kpi.hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Evolução mensal */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
          Evolução mensal
        </h2>
        <div className="etax-card">
          {/* Legenda */}
          <div className="flex items-center gap-4 mb-4 flex-wrap text-xs text-[var(--color-text-soft)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--color-status-ok)]" />
              Receita
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--color-status-danger)]" />
              Churn
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--color-status-warn)]" />
              Despesa
            </span>
          </div>

          <div className="overflow-x-auto">
            <div
              className="flex items-stretch gap-2"
              style={{ minWidth: `${fin.meses.length * 64}px` }}
            >
              {fin.meses.map((m) => {
                const semMovimento =
                  m.receita === 0 && m.churn === 0 && m.despesa === 0;
                return (
                  <div key={m.mes} className="flex-1 min-w-[56px]">
                    <div
                      className="flex items-end justify-center gap-1 h-36 border-b border-[var(--color-line)]"
                      title={`${mesLabel(m.mes)} — Receita ${formatBRL(m.receita)} · Churn ${formatBRL(m.churn)} · Despesa ${formatBRL(m.despesa)} · Líquida ${formatBRL(m.liquida)}`}
                    >
                      {semMovimento ? (
                        <span className="text-[10px] text-[var(--color-text-mute)] pb-1">
                          —
                        </span>
                      ) : (
                        <>
                          <div
                            className="w-4 rounded-t-sm bg-[var(--color-status-ok)]"
                            style={{
                              height: `${Math.max((m.receita / maxMensal) * 100, m.receita > 0 ? 3 : 0)}%`,
                            }}
                          />
                          {m.churn > 0 && (
                            <div
                              className="w-4 rounded-t-sm bg-[var(--color-status-danger)]"
                              style={{
                                height: `${Math.max((m.churn / maxMensal) * 100, 3)}%`,
                              }}
                            />
                          )}
                          {m.despesa > 0 && (
                            <div
                              className="w-4 rounded-t-sm bg-[var(--color-status-warn)]"
                              style={{
                                height: `${Math.max((m.despesa / maxMensal) * 100, 3)}%`,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 text-center text-[11px] font-medium text-[var(--color-text-soft)] capitalize">
                      {mesLabel(m.mes, { short: true })}
                    </p>
                    <p
                      className={`text-center text-[10px] ${
                        m.liquida > 0
                          ? "text-[var(--color-status-ok)]"
                          : m.liquida < 0
                            ? "text-[var(--color-status-danger)]"
                            : "text-[var(--color-text-mute)]"
                      }`}
                    >
                      {semMovimento ? "" : formatBRL(m.liquida)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-text-mute)]">
            Valor abaixo de cada mês = receita líquida (receita - churn).
          </p>
        </div>
      </section>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 items-start">
        {/* Por tipo de contrato */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
            Receita por tipo de contrato
          </h2>
          {fin.porTipo.length === 0 ? (
            <div className="etax-card text-center py-8">
              <p className="text-sm text-[var(--color-text-mute)]">
                Nenhuma receita no período
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {fin.porTipo.map((t) => {
                const share =
                  fin.receitaBruta > 0 ? (t.total / fin.receitaBruta) * 100 : 0;
                return (
                  <div key={t.tipo} className="etax-card py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-[var(--color-text)] capitalize truncate">
                        {t.tipo}
                      </p>
                      <p className="text-sm font-semibold text-[var(--color-text)] flex-shrink-0">
                        {formatBRL(t.total)}
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-line)] overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-[var(--color-status-ok)]"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--color-text-mute)]">
                      {t.qtd} {t.qtd === 1 ? "contrato" : "contratos"} ·{" "}
                      {share.toFixed(0)}% da receita
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Movimentações do período */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-3">
            Contratos do período
          </h2>
          {fin.assinados.length === 0 && fin.distratados.length === 0 ? (
            <div className="etax-card text-center py-8">
              <p className="text-sm text-[var(--color-text-mute)]">
                Nenhuma movimentação no período
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {fin.distratados.map((c) => (
                <Link
                  key={`d-${c.id}`}
                  href={`/contratos/${c.id}`}
                  className="etax-card py-3 border-l-4 border-[var(--color-status-danger)] hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {c.contraparte_nome}
                    </p>
                    <span className="text-sm font-semibold text-[var(--color-status-danger)] flex-shrink-0">
                      - {formatBRL(c.valor_distrato ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                    <span className="capitalize">{c.tipo}</span>
                    <span>·</span>
                    <span>
                      Distratado em{" "}
                      {c.data_distrato
                        ? new Date(
                            `${c.data_distrato}T12:00:00Z`
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                    </span>
                  </div>
                </Link>
              ))}
              {fin.assinados.map((c) => (
                <Link
                  key={c.id}
                  href={`/contratos/${c.id}`}
                  className="etax-card py-3 hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {c.contraparte_nome}
                    </p>
                    <span
                      className={`text-sm font-semibold flex-shrink-0 ${
                        c.natureza_financeira === "despesa"
                          ? "text-[var(--color-status-warn)]"
                          : "text-[var(--color-status-ok)]"
                      }`}
                    >
                      {formatBRL(c.valor ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                    <span className="capitalize">{c.tipo}</span>
                    <span>·</span>
                    <span>
                      Assinado em{" "}
                      {c.assinado_em
                        ? new Date(c.assinado_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
