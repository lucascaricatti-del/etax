import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/status-badge";
import type { SolicitacaoComDetalhes, CampoSchema } from "@/lib/types";

export default async function SolicitacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("solicitacoes")
    .select("*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*)")
    .eq("id", id)
    .single();

  if (!data) {
    notFound();
  }

  const s = data as unknown as SolicitacaoComDetalhes;
  const schema = (s.tipo_contrato?.schema_campos ?? []) as CampoSchema[];

  return (
    <div>
      <Link
        href="/solicitacoes"
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        &larr; Voltar para solicitações
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Solicitação</h1>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contraparte */}
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Contraparte
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Nome</dt>
              <dd className="font-medium">{s.contraparte?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">CPF/CNPJ</dt>
              <dd className="font-medium">{s.contraparte?.cpf_cnpj ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">E-mail</dt>
              <dd className="font-medium">{s.contraparte?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Telefone</dt>
              <dd className="font-medium">{s.contraparte?.telefone ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Info geral */}
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Informações gerais
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Tipo de contrato</dt>
              <dd className="font-medium">{s.tipo_contrato?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>
                <StatusBadge status={s.status} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Data de criação</dt>
              <dd className="font-medium">
                {new Date(s.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
          </dl>
        </div>

        {/* Dados do formulário */}
        <div className="rounded-lg border border-gray-200 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Dados do formulário
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {schema.map((campo) => (
              <div key={campo.key}>
                <dt className="text-sm text-gray-500">{campo.label}</dt>
                <dd className="text-sm font-medium">
                  {String(s.dados[campo.key] ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Observações */}
        {s.observacoes && (
          <div className="rounded-lg border border-gray-200 p-5 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Observações
            </h2>
            <p className="text-sm whitespace-pre-wrap">{s.observacoes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
