import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Sessao {
  user: { id: string; email?: string };
  profile: { id: string; nome: string | null; tipo_usuario: string; papel_etax: string | null } | null;
  isEtax: boolean;
  isAdmin: boolean;
  workspaceIds: string[];
}

export async function getSessao(): Promise<Sessao | null> {
  // Cookie client — only for identifying the logged-in user via session cookies
  const authClient = await createClient();

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return null;

  // Admin client — bypasses RLS for profile & membership reads
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, nome, tipo_usuario, papel_etax")
    .eq("id", user.id)
    .single();

  const isEtax = profile?.tipo_usuario === "etax";
  const isAdmin = isEtax && profile?.papel_etax === "admin";

  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map(
    (m: { workspace_id: string }) => m.workspace_id
  );

  return {
    user: { id: user.id, email: user.email },
    profile,
    isEtax,
    isAdmin,
    workspaceIds,
  };
}
