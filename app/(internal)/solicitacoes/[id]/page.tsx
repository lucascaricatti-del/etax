import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { GerarContratoButton } from "./gerar-contrato-button";
import { EnviarAprovacaoButton } from "./enviar-aprovacao-button";
import { AprovarReprovarButtons } from "./aprovar-reprovar-buttons";
import { DadosEditor } from "./dados-editor";
import { ContraparteEditor } from "./contraparte-editor";
import type { SolicitacaoComDetalhes, CampoSchema } from "@/lib/types";

export default async function SolicitacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessao();
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("solicitacoes")
    .select(
      "*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*), modelo:modelos(id, nome, descricao, versao)"
    )
    .eq("id", id)
    .single();

  if (!data) {
    notFound();
  }

  const s = data as unknown as SolicitacaoComDetalhes;
  const schema = (s.tipo_contrato?.schema_campos ?? []) as CampoSchema[];
  const canEdit =
    (sessao?.isEtax ?? false) &&
    ["nova", "em_confeccao"].includes(s.status);

  // O signatário é o representante legal (dados.email), não o email da contraparte/empresa
  const signerNome =
    (s.dados.rep_nome as string) ||
    (s.dados.nome as string) ||
    s.contraparte?.nome ||
    "—";
  const signerEmail = (s.dados.email as string) || null;

  // Action buttons by status + role
  const showEnviarAprovacao =
    (sessao?.isEtax ?? false) && ["nova", "em_confeccao"].includes(s.status);
  const showAprovarReprovar =
    (sessao?.isAdmin ?? false) && s.status === "aguardando_aprovacao";
  const showGerarContrato =
    (sessao?.isEtax ?? false) && s.status === "aprovada";

  return (
    <div>
      <Link
        href="/solicitacoes"
        className="text-sm text-[var(--color-text-soft)] hover:text-[var(--color-text)] mb-4 inline-block"
      >
        &larr; Voltar para solicitações
      </Link>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Solicitação
        </h1>
        <StatusBadge status={s.status} />
        {showEnviarAprovacao && (
          <EnviarAprovacaoButton
            solicitacaoId={s.id}
            tipoContratoId={s.tipo_contrato_id}
            workspaceId={s.workspace_id}
            signerNome={signerNome}
            signerEmail={signerEmail}
          />
        )}
        {showAprovarReprovar && (
          <AprovarReprovarButtons solicitacaoId={s.id} />
        )}
        {showGerarContrato && (
          <GerarContratoButton
            solicitacaoId={s.id}
            signerNome={signerNome}
            signerEmail={signerEmail}
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contraparte — editável */}
        {s.contraparte && (
          <ContraparteEditor
            contraparte={s.contraparte}
            canEdit={sessao?.isEtax ?? false}
          />
        )}

        {/* Info geral */}
        <div className="etax-card">
          <h2 className="etax-section-label">Informações gerais</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-text-mute)]">Tipo de contrato</dt>
              <dd className="font-medium">
                {s.tipo_contrato?.nome ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-mute)]">Status</dt>
              <dd>
                <StatusBadge status={s.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-mute)]">Data de criação</dt>
              <dd className="font-medium">
                {new Date(s.criado_em).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            {s.modelo && (
              <div>
                <dt className="text-[var(--color-text-mute)]">Modelo selecionado</dt>
                <dd className="font-medium">
                  {s.modelo.nome || `Modelo v${s.modelo.versao}`}
                </dd>
              </div>
            )}
            {s.aprovado_em && (
              <div>
                <dt className="text-[var(--color-text-mute)]">Data de aprovação</dt>
                <dd className="font-medium">
                  {new Date(s.aprovado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dados do formulário — editável */}
        <DadosEditor
          solicitacaoId={s.id}
          dados={s.dados}
          schema={schema}
          canEdit={canEdit}
        />

        {/* Motivo da reprovação */}
        {s.motivo_reprovacao && s.status === "em_confeccao" && (
          <div className="etax-card md:col-span-2 border-l-4 border-[var(--color-status-danger)]">
            <h2 className="etax-section-label text-[var(--color-status-danger)]">
              Motivo da reprovação
            </h2>
            <p className="text-sm whitespace-pre-wrap">{s.motivo_reprovacao}</p>
          </div>
        )}

        {/* Observações */}
        {s.observacoes && (
          <div className="etax-card md:col-span-2">
            <h2 className="etax-section-label">Observações</h2>
            <p className="text-sm whitespace-pre-wrap">{s.observacoes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
