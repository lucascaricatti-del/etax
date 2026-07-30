import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { InviteForm } from "@/components/invite-form";

export default async function EquipePage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  // Etax gerencia membros pelo detalhe da empresa
  if (sessao.isEtax) redirect("/empresas");
  if (sessao.workspaceIds.length === 0) redirect("/dashboard");

  const workspaceId = sessao.workspaceIds[0];
  const supabase = createAdminClient();

  const [workspaceResult, membersResult, invitesResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, nome, nome_fantasia")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("workspace_members")
      .select("workspace_id, user_id, papel, criado_em")
      .eq("workspace_id", workspaceId)
      .order("criado_em"),
    supabase
      .from("workspace_invites")
      .select("id, email, papel, aceito_em, criado_em")
      .eq("workspace_id", workspaceId)
      .order("criado_em", { ascending: false }),
  ]);

  const workspace = workspaceResult.data;
  const members = membersResult.data ?? [];
  const invites = invitesResult.data ?? [];

  // Fetch profiles for members
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const membersList = members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id),
  }));

  const displayName = workspace?.nome_fantasia || workspace?.nome || "Empresa";

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Equipe
        </h1>
        <p className="text-sm text-[var(--color-text-mute)] mt-1">
          Membros de {displayName} com acesso ao sistema
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Membros */}
        <div className="etax-card">
          <h2 className="etax-section-label">Membros ({membersList.length})</h2>
          {membersList.length === 0 ? (
            <p className="text-sm text-[var(--color-text-mute)]">
              Nenhum membro.
            </p>
          ) : (
            <ul className="space-y-2">
              {membersList.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 text-sm py-1"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.profile?.nome ?? "Sem nome"}
                      {m.user_id === sessao.user.id && (
                        <span className="text-[var(--color-text-mute)] font-normal">
                          {" "}
                          (você)
                        </span>
                      )}
                    </p>
                    {m.profile?.email && (
                      <p className="text-xs text-[var(--color-text-mute)] truncate">
                        {m.profile.email}
                      </p>
                    )}
                  </div>
                  <span className="text-[var(--color-text-mute)] text-xs capitalize flex-shrink-0">
                    {m.papel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Convidar */}
        <div className="etax-card">
          <h2 className="etax-section-label">Convidar membro</h2>
          <p className="text-sm text-[var(--color-text-mute)] mb-4">
            Gere um link de convite e envie para a pessoa. O link vale por 7
            dias.
          </p>
          <InviteForm workspaceId={workspaceId} />
        </div>

        {/* Convites enviados */}
        {invites.length > 0 && (
          <div className="etax-card md:col-span-2">
            <h2 className="etax-section-label">Convites enviados</h2>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-sm border border-[var(--color-line)] rounded-[var(--radius-btn)] p-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium truncate">{inv.email}</span>
                    <span className="text-[var(--color-text-mute)] text-xs ml-2 capitalize">
                      ({inv.papel})
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium flex-shrink-0 ${
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
          </div>
        )}
      </div>
    </div>
  );
}
