import Link from "next/link";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { fetchDashboardData } from "@/lib/queries/contratos";

export default async function DashboardPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const {
    totalAtivos,
    aguardandoAssinatura,
    assinadosMes,
    aVencer30,
    aguardandoAprovacao,
    recentes,
    vencimentos,
  } = await fetchDashboardData(sessao);

  const now = new Date();
  const isEtax = sessao.isEtax;

  const kpis = [
    { label: "Contratos ativos", value: totalAtivos, color: "text-[var(--color-text)]" },
    { label: "Aguardando assinatura", value: aguardandoAssinatura, color: "text-[var(--color-status-warn)]" },
    { label: "Assinados no mês", value: assinadosMes, color: "text-[var(--color-status-ok)]" },
    { label: "A vencer (30 dias)", value: aVencer30, color: aVencer30 > 0 ? "text-[var(--color-status-danger)]" : "text-[var(--color-text-mute)]" },
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)] mb-6">
        Dashboard
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {kpis.map((kpi) => (
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

      {/* Aguardando aprovação — só Etax */}
      {isEtax && aguardandoAprovacao > 0 && (
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

      <div className="grid gap-6 md:grid-cols-2">
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
                  <div key={c.id} className="etax-card py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {contraparte?.nome ?? "—"}
                        </p>
                        {isEtax && workspace && (
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
                  </div>
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
                        {isEtax && workspace && (
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
