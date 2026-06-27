import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";

export default async function DashboardPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const supabase = createAdminClient();
  const isEtax = sessao.isEtax;
  const wsIds = sessao.workspaceIds;

  // Helpers para escopo: Etax vê tudo, cliente filtra por workspace
  function scopedContratos() {
    let q = supabase.from("contratos").select("id", { count: "exact", head: true });
    if (!isEtax && wsIds.length > 0) q = q.in("workspace_id", wsIds);
    else if (!isEtax) q = q.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
    return q;
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Todas as queries em paralelo
  const [
    { count: totalAtivos },
    { count: aguardandoAssinatura },
    { count: assinadosMes },
    { count: aVencer30 },
    { count: aguardandoAprovacao },
    { data: recentes },
    { data: vencimentos },
  ] = await Promise.all([
    // KPI 1: contratos ativos (status_assinatura != expirado/recusado)
    scopedContratos()
      .not("status_assinatura", "in", "(recusado,expirado)"),

    // KPI 2: aguardando assinatura
    scopedContratos()
      .eq("status_assinatura", "aguardando_assinatura"),

    // KPI 3: assinados neste mês
    scopedContratos()
      .eq("status_assinatura", "assinado")
      .gte("assinado_em", startOfMonth),

    // KPI 4: a vencer em 30 dias
    scopedContratos()
      .not("vigencia_fim", "is", null)
      .lte("vigencia_fim", thirtyDaysFromNow.toISOString())
      .gte("vigencia_fim", now.toISOString()),

    // Aguardando aprovação (só conta se Etax)
    isEtax
      ? supabase
          .from("solicitacoes")
          .select("id", { count: "exact", head: true })
          .eq("status", "aguardando_aprovacao")
      : Promise.resolve({ count: 0 }),

    // Contratos recentes (últimos 10)
    (() => {
      let q = supabase
        .from("contratos")
        .select("id, tipo, valor, status_assinatura, criado_em, assinado_em, contraparte:contrapartes(nome)")
        .order("criado_em", { ascending: false })
        .limit(10);
      if (!isEtax && wsIds.length > 0) q = q.in("workspace_id", wsIds);
      else if (!isEtax) q = q.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
      return q;
    })(),

    // Vencimentos próximos (30 dias)
    (() => {
      let q = supabase
        .from("contratos")
        .select("id, tipo, vigencia_fim, contraparte:contrapartes(nome)")
        .not("vigencia_fim", "is", null)
        .lte("vigencia_fim", thirtyDaysFromNow.toISOString())
        .gte("vigencia_fim", now.toISOString())
        .order("vigencia_fim", { ascending: true })
        .limit(5);
      if (!isEtax && wsIds.length > 0) q = q.in("workspace_id", wsIds);
      else if (!isEtax) q = q.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
      return q;
    })(),
  ]);

  const kpis = [
    { label: "Contratos ativos", value: totalAtivos ?? 0, color: "text-[var(--color-text)]" },
    { label: "Aguardando assinatura", value: aguardandoAssinatura ?? 0, color: "text-[var(--color-status-warn)]" },
    { label: "Assinados no mês", value: assinadosMes ?? 0, color: "text-[var(--color-status-ok)]" },
    { label: "A vencer (30 dias)", value: aVencer30 ?? 0, color: (aVencer30 ?? 0) > 0 ? "text-[var(--color-status-danger)]" : "text-[var(--color-text-mute)]" },
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
      {isEtax && (aguardandoAprovacao ?? 0) > 0 && (
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

          {!recentes || recentes.length === 0 ? (
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
                  <div key={c.id} className="etax-card py-3">
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

          {!vencimentos || vencimentos.length === 0 ? (
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
                        className={`text-xs font-semibold ${
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
