import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Sessao {
  user: { id: string; email?: string };
  profile: { id: string; nome: string | null; tipo_usuario: string } | null;
  isEtax: boolean;
  workspaceIds: string[];
}

export async function getSessao(): Promise<Sessao | null> {
  // Cookie client — only for identifying the logged-in user via session cookies
  const authClient = await createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  console.log("[getSessao] auth.getUser():", {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: userError?.message ?? null,
  });

  if (!user) return null;

  // Admin client — bypasses RLS for profile & membership reads
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, nome, tipo_usuario")
    .eq("id", user.id)
    .single();

  const isEtax = profile?.tipo_usuario === "etax";

  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map(
    (m: { workspace_id: string }) => m.workspace_id
  );

  console.log("[getSessao] result:", {
    userId: user.id,
    isEtax,
    tipoUsuario: profile?.tipo_usuario ?? null,
    workspaceIds,
  });

  return {
    user: { id: user.id, email: user.email },
    profile,
    isEtax,
    workspaceIds,
  };
}
