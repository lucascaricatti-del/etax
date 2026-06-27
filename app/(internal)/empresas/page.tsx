import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { NovaEmpresaForm } from "./nova-empresa-form";

export default async function EmpresasPage() {
  const sessao = await getSessao();
  if (!sessao?.isEtax) redirect("/solicitacoes");

  const supabase = createAdminClient();

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, nome, cnpj, slug, ativo, created_at")
    .order("nome");

  console.log("[/empresas] workspaces query:", {
    count: workspaces?.length ?? 0,
    error: wsError?.message ?? null,
  });

  // Fetch member counts
  const { data: memberCounts } = await supabase
    .from("workspace_members")
    .select("workspace_id");

  // Fetch solicitacao counts
  const { data: solCounts } = await supabase
    .from("solicitacoes")
    .select("workspace_id");

  const membersMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    membersMap.set(m.workspace_id, (membersMap.get(m.workspace_id) ?? 0) + 1);
  }

  const solsMap = new Map<string, number>();
  for (const s of solCounts ?? []) {
    if (s.workspace_id) {
      solsMap.set(s.workspace_id, (solsMap.get(s.workspace_id) ?? 0) + 1);
    }
  }

  const items = workspaces ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Empresas</h1>
      </div>

      <NovaEmpresaForm />

      <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nome
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                CNPJ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Membros
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Solicitações
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
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
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Nenhuma empresa cadastrada.
                </td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {w.nome}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {w.cnpj ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {membersMap.get(w.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {solsMap.get(w.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        w.ativo
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {w.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/empresas/${w.id}`}
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
