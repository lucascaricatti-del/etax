import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";

export default async function ConfeccaoPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isEtax) redirect("/dashboard");

  const supabase = createAdminClient();

  // Pending approvals
  const { data: pendentes } = await supabase
    .from("solicitacoes")
    .select(
      "id, status, dados, criado_em, tipo_contrato_id, contraparte:contrapartes(nome), tipo_contrato:tipos_contrato(nome), modelo:modelos(nome, versao)"
    )
    .eq("status", "aguardando_aprovacao")
    .order("criado_em", { ascending: true });

  // Recently approved (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: aprovadas } = await supabase
    .from("solicitacoes")
    .select(
      "id, status, dados, aprovado_em, contraparte:contrapartes(nome), tipo_contrato:tipos_contrato(nome), modelo:modelos(nome, versao)"
    )
    .eq("status", "aprovada")
    .gte("aprovado_em", sevenDaysAgo.toISOString())
    .order("aprovado_em", { ascending: false })
    .limit(20);

  const pendingCount = pendentes?.length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Confecção
        </h1>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)] text-sm font-bold">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Pending approvals */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
          Aguardando aprovação
          {pendingCount > 0 && ` (${pendingCount})`}
        </h2>

        {pendingCount === 0 ? (
          <div className="etax-card text-center py-8">
            <p className="text-sm text-[var(--color-text-mute)]">
              Nenhuma solicitação aguardando aprovação
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pendentes!.map((sol) => {
              const contraparte = sol.contraparte as unknown as { nome: string } | null;
              const tipoContrato = sol.tipo_contrato as unknown as { nome: string } | null;
              const modelo = sol.modelo as unknown as { nome: string | null; versao: number } | null;
              const dados = sol.dados as Record<string, unknown>;
              const valor = dados?.valor_total;

              return (
                <Link
                  key={sol.id}
                  href={`/solicitacoes/${sol.id}`}
                  className="etax-card block hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                      {contraparte?.nome ?? "—"}
                    </p>
                    <StatusBadge status={sol.status} />
                  </div>

                  <div className="space-y-1 text-xs text-[var(--color-text-soft)]">
                    <div className="flex justify-between">
                      <span>{tipoContrato?.nome ?? "—"}</span>
                      {valor != null && valor !== "" && (
                        <span className="font-medium text-[var(--color-text)]">
                          {typeof valor === "number"
                            ? formatBRL(valor)
                            : String(valor)}
                        </span>
                      )}
                    </div>
                    {modelo && (
                      <p>
                        Modelo: {modelo.nome || `v${modelo.versao}`}
                      </p>
                    )}
                    <p>
                      {new Date(sol.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently approved */}
      {aprovadas && aprovadas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
            Aprovadas recentemente
          </h2>

          <div className="grid gap-3">
            {aprovadas.map((sol) => {
              const contraparte = sol.contraparte as unknown as { nome: string } | null;
              const tipoContrato = sol.tipo_contrato as unknown as { nome: string } | null;
              const modelo = sol.modelo as unknown as { nome: string | null; versao: number } | null;

              return (
                <Link
                  key={sol.id}
                  href={`/solicitacoes/${sol.id}`}
                  className="etax-card block hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow opacity-80 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm text-[var(--color-text)] truncate">
                      {contraparte?.nome ?? "—"}
                    </p>
                    <StatusBadge status={sol.status} />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                    <span>{tipoContrato?.nome ?? "—"}</span>
                    {modelo && (
                      <>
                        <span>·</span>
                        <span>{modelo.nome || `v${modelo.versao}`}</span>
                      </>
                    )}
                    {sol.aprovado_em && (
                      <>
                        <span>·</span>
                        <span>
                          {new Date(sol.aprovado_em as string).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
