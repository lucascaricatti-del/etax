import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { InviteForm } from "./invite-form";
import { EditEmpresaForm } from "./edit-empresa-form";
import { Eye } from "lucide-react";

export default async function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao?.isEtax) redirect("/dashboard");

  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch workspace first (needed for notFound check)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, nome, nome_fantasia, cnpj, slug, ativo, criado_em")
    .eq("id", id)
    .single();

  if (!workspace) notFound();

  // Fetch related data in parallel
  const [membersResult, solicitacoesResult, invitesResult] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_id, user_id, papel, criado_em")
      .eq("workspace_id", id)
      .order("criado_em"),
    supabase
      .from("solicitacoes")
      .select("id, status, criado_em, contraparte:contrapartes(nome), tipo_contrato:tipos_contrato(nome)")
      .eq("workspace_id", id)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("workspace_invites")
      .select("id, email, papel, aceito_em, criado_em")
      .eq("workspace_id", id)
      .order("criado_em", { ascending: false }),
  ]);

  const members = membersResult.data ?? [];

  // Fetch profiles for members
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, nome, tipo_usuario")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const membersList = members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id),
  }));

  const solicitacoes = solicitacoesResult.data ?? [];
  const invites = invitesResult.data ?? [];
  const displayName = workspace.nome_fantasia || workspace.nome;

  return (
    <div>
      <Link
        href="/empresas"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4"
      >
        &larr; Voltar para empresas
      </Link>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
            {displayName}
          </h1>
          {workspace.nome_fantasia && (
            <p className="text-sm text-[var(--color-text-mute)] mt-0.5">
              {workspace.nome}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            workspace.ativo
              ? "bg-[var(--color-status-ok-bg)] text-[var(--color-status-ok)]"
              : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]"
          }`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            workspace.ativo ? "bg-[var(--color-status-ok)]" : "bg-[var(--color-status-info)]"
          }`} />
          {workspace.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados */}
        <div className="etax-card">
          <h2 className="etax-section-label">Dados</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-mute)]">Razão Social</dt>
              <dd className="font-medium text-right">{workspace.nome}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-mute)]">Nome Fantasia</dt>
              <dd className="font-medium text-right">{workspace.nome_fantasia ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-mute)]">CNPJ</dt>
              <dd className="font-medium font-mono text-xs text-right">{workspace.cnpj ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-mute)]">Slug</dt>
              <dd className="font-medium text-right">{workspace.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-mute)]">Criado em</dt>
              <dd className="font-medium text-right">
                {new Date(workspace.criado_em).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          </dl>
          <EditEmpresaForm
            workspace={{
              id: workspace.id,
              nome: workspace.nome,
              nome_fantasia: workspace.nome_fantasia,
              cnpj: workspace.cnpj,
              ativo: workspace.ativo,
            }}
            isAdmin={sessao.isAdmin}
          />
        </div>

        {/* Membros */}
        <div className="etax-card">
          <h2 className="etax-section-label">Membros ({membersList.length})</h2>
          {membersList.length === 0 ? (
            <p className="text-sm text-[var(--color-text-mute)]">Nenhum membro.</p>
          ) : (
            <ul className="space-y-2">
              {membersList.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between text-sm py-1">
                  <span className="font-medium">
                    {m.profile?.nome ?? "Sem nome"}
                  </span>
                  <span className="text-[var(--color-text-mute)] text-xs capitalize">{m.papel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Convidar */}
        <div className="etax-card md:col-span-2">
          <h2 className="etax-section-label">Convidar usuário</h2>
          <InviteForm workspaceId={id} />

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text-mute)] uppercase">
                Convites enviados
              </h3>
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-sm border border-[var(--color-line)] rounded-[var(--radius-btn)] p-2"
                >
                  <div>
                    <span className="font-medium">{inv.email}</span>
                    <span className="text-[var(--color-text-mute)] text-xs ml-2">
                      ({inv.papel})
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      inv.aceito_em
                        ? "text-[var(--color-status-ok)]"
                        : "text-[var(--color-status-warn)]"
                    }`}
                  >
                    {inv.aceito_em ? "Aceito" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solicitações */}
        <div className="etax-card md:col-span-2 p-0">
          <h2 className="etax-section-label px-5 pt-5">
            Solicitações ({solicitacoes.length})
          </h2>
          {solicitacoes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-mute)] px-5 pb-5">
              Nenhuma solicitação neste workspace.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden sm:block">
                <table className="etax-table">
                  <thead>
                    <tr>
                      <th>Contraparte</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th className="text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitacoes.map((s: Record<string, unknown>) => (
                      <tr key={s.id as string}>
                        <td className="font-medium">
                          {(s.contraparte as { nome?: string })?.nome ?? "—"}
                        </td>
                        <td className="text-[var(--color-text-soft)]">
                          {(s.tipo_contrato as { nome?: string })?.nome ?? "—"}
                        </td>
                        <td>
                          <StatusBadge status={s.status as string} />
                        </td>
                        <td className="text-[var(--color-text-soft)]">
                          {new Date(s.criado_em as string).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/solicitacoes/${s.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                          >
                            <Eye size={14} />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden px-5 pb-5 space-y-2">
                {solicitacoes.map((s: Record<string, unknown>) => (
                  <Link
                    key={s.id as string}
                    href={`/solicitacoes/${s.id}`}
                    className="block p-3 rounded-[var(--radius-btn)] border border-[var(--color-line)] hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">
                        {(s.contraparte as { nome?: string })?.nome ?? "—"}
                      </p>
                      <StatusBadge status={s.status as string} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                      <span>{(s.tipo_contrato as { nome?: string })?.nome ?? "—"}</span>
                      <span>·</span>
                      <span>{new Date(s.criado_em as string).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
