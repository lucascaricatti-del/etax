import Link from "next/link";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { fetchContratosPorAssinatura } from "@/lib/queries/contratos";

export default async function AssinaturasPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isEtax) redirect("/solicitacoes");

  const { pendentes, finalizados } = await fetchContratosPorAssinatura(sessao);

  const pendingCount = pendentes.data?.length ?? 0;
  const isEtax = sessao.isEtax;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)]">
          Assinaturas
        </h1>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[var(--color-status-warn-bg)] text-[var(--color-status-warn)] text-sm font-bold">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Aguardando assinatura */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
          Aguardando assinatura
          {pendingCount > 0 && ` (${pendingCount})`}
        </h2>

        {pendingCount === 0 ? (
          <div className="etax-card text-center py-8">
            <p className="text-sm text-[var(--color-text-mute)]">
              Nenhum contrato aguardando assinatura
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pendentes.data!.map((c) => {
              const contraparte = c.contraparte as unknown as { nome: string; cpf_cnpj: string } | null;
              const workspace = c.workspace as unknown as { id: string; nome: string; nome_fantasia: string | null } | null;

              return (
                <div key={c.id} className="etax-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                        {contraparte?.nome ?? "—"}
                      </p>
                      {isEtax && workspace && (
                        <p className="text-xs text-[var(--color-text-mute)] truncate mt-0.5">
                          {workspace.nome_fantasia || workspace.nome}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={c.status_assinatura} />
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
                    <p>
                      Enviado em{" "}
                      {new Date(c.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Finalizados */}
      {finalizados.data && finalizados.data.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide mb-4">
            Finalizados recentemente
          </h2>

          <div className="grid gap-3">
            {finalizados.data.map((c) => {
              const contraparte = c.contraparte as unknown as { nome: string; cpf_cnpj: string } | null;
              const workspace = c.workspace as unknown as { id: string; nome: string; nome_fantasia: string | null } | null;

              return (
                <Link
                  key={c.id}
                  href={`/contratos?id=${c.id}`}
                  className="etax-card block hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">
                        {contraparte?.nome ?? "—"}
                      </p>
                      {isEtax && workspace && (
                        <p className="text-xs text-[var(--color-text-mute)] truncate mt-0.5">
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
                    {c.assinado_em && (
                      <>
                        <span>·</span>
                        <span>
                          {new Date(c.assinado_em).toLocaleDateString("pt-BR", {
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
