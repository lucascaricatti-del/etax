import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { token, password, nome } = body;

  if (!token || !password || !nome) {
    return NextResponse.json(
      { error: "Token, nome e senha são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("id, email, role, workspace_id, accepted, expires_at")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: "Convite não encontrado" },
      { status: 404 }
    );
  }

  if (invite.accepted) {
    return NextResponse.json(
      { error: "Convite já foi aceito" },
      { status: 400 }
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Convite expirado" },
      { status: 400 }
    );
  }

  // 2. Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Erro ao criar conta: " + (authError?.message ?? "desconhecido") },
      { status: 500 }
    );
  }

  const userId = authData.user.id;

  // 3. Create profile
  await supabase.from("profiles").upsert({
    id: userId,
    nome,
    tipo_usuario: "cliente",
  });

  // 4. Add to workspace_members
  await supabase.from("workspace_members").insert({
    workspace_id: invite.workspace_id,
    user_id: userId,
    role: invite.role,
  });

  // 5. Mark invite as accepted
  await supabase
    .from("workspace_invites")
    .update({ accepted: true })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
