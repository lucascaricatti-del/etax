import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { NovaEmpresaForm } from "./nova-empresa-form";

export default async function EmpresasPage() {
  const sessao = await getSessao();
  if (!sessao?.isEtax) redirect("/solicitacoes");

  const supabase = createAdminClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, nome, cnpj, slug, ativo, criado_em")
    .order("nome");

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
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)]">
          Empresas
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-mute)]">
          Gestão de workspaces e clientes
        </p>
      </div>

      <NovaEmpresaForm />

      <div className="etax-card mt-6 overflow-x-auto p-0">
        <table className="etax-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CNPJ</th>
              <th>Membros</th>
              <th>Solicitações</th>
              <th>Status</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="!text-center !py-8 text-[var(--color-text-mute)]"
                >
                  Nenhuma empresa cadastrada.
                </td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.id}>
                  <td className="font-medium">{w.nome}</td>
                  <td className="text-[var(--color-text-soft)]">
                    {w.cnpj ?? "—"}
                  </td>
                  <td className="text-[var(--color-text-soft)]">
                    {membersMap.get(w.id) ?? 0}
                  </td>
                  <td className="text-[var(--color-text-soft)]">
                    {solsMap.get(w.id) ?? 0}
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        w.ativo
                          ? "bg-[var(--color-status-ok-bg)] text-[var(--color-status-ok)]"
                          : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]"
                      }`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                        w.ativo ? "bg-[var(--color-status-ok)]" : "bg-[var(--color-status-info)]"
                      }`} />
                      {w.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/empresas/${w.id}`}
                      className="text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
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
