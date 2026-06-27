import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { InviteForm } from "./invite-form";

export default async function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao?.isEtax) redirect("/solicitacoes");

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (!workspace) notFound();

  // Fetch members with profiles
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, role, created_at, user_id")
    .eq("workspace_id", id)
    .order("created_at");

  // Fetch profiles for members
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, nome, tipo_usuario")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // Fetch user emails from auth (via admin)
  const membersList = (members ?? []).map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id),
  }));

  // Fetch solicitacoes for this workspace
  const { data: solicitacoes } = await supabase
    .from("solicitacoes")
    .select("id, status, dados, created_at, tipo_contrato:tipos_contrato(nome), contraparte:contrapartes(nome)")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch pending invites
  const { data: invites } = await supabase
    .from("workspace_invites")
    .select("id, email, role, token, accepted, created_at")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <Link
        href="/empresas"
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        &larr; Voltar para empresas
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{workspace.nome}</h1>
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
            workspace.ativo
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {workspace.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados */}
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Dados
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">CNPJ</dt>
              <dd className="font-medium">{workspace.cnpj ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Slug</dt>
              <dd className="font-medium">{workspace.slug}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Criado em</dt>
              <dd className="font-medium">
                {new Date(workspace.created_at).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          </dl>
        </div>

        {/* Membros */}
        <div className="rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Membros ({membersList.length})
          </h2>
          {membersList.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum membro.</p>
          ) : (
            <ul className="space-y-2">
              {membersList.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {m.profile?.nome ?? "Sem nome"}
                  </span>
                  <span className="text-gray-500 text-xs">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Convidar */}
        <div className="rounded-lg border border-gray-200 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Convidar usuário
          </h2>
          <InviteForm workspaceId={id} />

          {(invites ?? []).length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase">
                Convites enviados
              </h3>
              {(invites ?? []).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-sm border border-gray-100 rounded p-2"
                >
                  <div>
                    <span className="font-medium">{inv.email}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      ({inv.role})
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      inv.accepted ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {inv.accepted ? "Aceito" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solicitações */}
        <div className="rounded-lg border border-gray-200 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Solicitações
          </h2>
          {(solicitacoes ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma solicitação neste workspace.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Contraparte
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Data
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(solicitacoes ?? []).map((s: Record<string, unknown>) => (
                    <tr key={s.id as string}>
                      <td className="px-3 py-2 text-sm">
                        {(s.contraparte as { nome?: string })?.nome ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {(s.tipo_contrato as { nome?: string })?.nome ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={s.status as string} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {new Date(s.created_at as string).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/solicitacoes/${s.id}`}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
