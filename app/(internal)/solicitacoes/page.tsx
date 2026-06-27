import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/status-badge";
import type { SolicitacaoComDetalhes } from "@/lib/types";
import { Filters } from "./filters";

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string }>;
}) {
  const { tipo, status } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("solicitacoes")
    .select("*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*)")
    .order("created_at", { ascending: false });

  if (tipo) {
    query = query.eq("tipo_contrato_id", tipo);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: solicitacoes } = await query;

  // Fetch tipos for filter dropdown
  const { data: tipos } = await supabase
    .from("tipos_contrato")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const items = (solicitacoes ?? []) as unknown as SolicitacaoComDetalhes[];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Solicitações</h1>

      <Filters
        tipos={tipos ?? []}
        tipoAtual={tipo}
        statusAtual={status}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contraparte
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.contraparte?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.tipo_contrato?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/solicitacoes/${s.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
