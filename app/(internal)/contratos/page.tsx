import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/format";

export default async function ContratosPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  const supabase = createAdminClient();

  let query = supabase
    .from("contratos")
    .select(
      "id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim, assinado_em, criado_em, pdf_assinado_path, workspace_id, contraparte:contrapartes(nome, cpf_cnpj)"
    )
    .order("criado_em", { ascending: false });

  // Cliente só vê contratos do seu workspace
  if (!sessao.isEtax) {
    if (sessao.workspaceIds.length === 0) {
      query = query.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
    } else if (sessao.workspaceIds.length === 1) {
      query = query.eq("workspace_id", sessao.workspaceIds[0]);
    } else {
      query = query.in("workspace_id", sessao.workspaceIds);
    }
  }

  const { data: contratos, error } = await query;

  if (error) {
    console.error("[Contratos] Erro na query:", error);
  }

  const total = contratos?.length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)]">
          Contratos
        </h1>
        <span className="text-sm text-[var(--color-text-mute)]">
          {total} {total === 1 ? "contrato" : "contratos"}
        </span>
      </div>

      {total === 0 ? (
        <div className="etax-card text-center py-8">
          <p className="text-sm text-[var(--color-text-mute)]">
            Nenhum contrato encontrado
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {contratos!.map((c) => {
            const contraparte = c.contraparte as unknown as { nome: string; cpf_cnpj: string } | null;

            return (
              <div key={c.id} className="etax-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                    {contraparte?.nome ?? "—"}
                  </p>
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
                    <span>
                      Criado em{" "}
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
                          Assinado em{" "}
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
                    <PdfDownloadLink contratoId={c.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PdfDownloadLink({ contratoId }: { contratoId: string }) {
  return (
    <a
      href={`/api/contratos/${contratoId}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
    >
      Baixar PDF assinado
    </a>
  );
}
