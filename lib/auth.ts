import { createClient } from "@/lib/supabase/server";

export interface Sessao {
  user: { id: string; email?: string };
  profile: { id: string; nome: string | null; tipo_usuario: string } | null;
  isEtax: boolean;
  workspaceIds: string[];
}

export async function getSessao(): Promise<Sessao | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, tipo_usuario")
    .eq("id", user.id)
    .single();

  const isEtax = profile?.tipo_usuario === "etax";

  const { data: memberships } = await supabase
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
    workspaceIds,
  };
}
