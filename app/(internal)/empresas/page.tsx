import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { NovaEmpresaForm } from "./nova-empresa-form";

export default async function EmpresasPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isEtax) redirect("/dashboard");

  const supabase = createAdminClient();

  // Single query with embedded relationship counts
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, nome, nome_fantasia, cnpj, slug, ativo, criado_em, workspace_members(count), solicitacoes(count)")
    .order("nome");

  const items = (workspaces ?? []) as unknown as Array<{
    id: string;
    nome: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    slug: string;
    ativo: boolean;
    criado_em: string;
    workspace_members: [{ count: number }];
    solicitacoes: [{ count: number }];
  }>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Empresas
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-mute)]">
          Gestão de workspaces e clientes
        </p>
      </div>

      <NovaEmpresaForm />

      {items.length === 0 ? (
        <div className="etax-card mt-6 text-center py-8">
          <p className="text-sm text-[var(--color-text-mute)]">
            Nenhuma empresa cadastrada.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 mt-6">
          {items.map((w) => (
            <Link
              key={w.id}
              href={`/empresas/${w.id}`}
              className="etax-card block hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                    {w.nome_fantasia || w.nome}
                  </p>
                  {w.nome_fantasia && (
                    <p className="text-xs text-[var(--color-text-mute)] truncate mt-0.5">
                      {w.nome}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                    w.ativo
                      ? "bg-[var(--color-status-ok-bg)] text-[var(--color-status-ok)]"
                      : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      w.ativo
                        ? "bg-[var(--color-status-ok)]"
                        : "bg-[var(--color-status-info)]"
                    }`}
                  />
                  {w.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--color-text-soft)]">
                <span>{w.cnpj ?? "Sem CNPJ"}</span>
                <span>·</span>
                <span>{w.workspace_members?.[0]?.count ?? 0} membros</span>
                <span>·</span>
                <span>{w.solicitacoes?.[0]?.count ?? 0} solicitações</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
