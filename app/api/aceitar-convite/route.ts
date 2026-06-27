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
    .select("id, email, papel, workspace_id, aceito_em, expira_em")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: "Convite não encontrado" },
      { status: 404 }
    );
  }

  if (invite.aceito_em) {
    return NextResponse.json(
      { error: "Convite já foi aceito" },
      { status: 400 }
    );
  }

  if (new Date(invite.expira_em) < new Date()) {
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
    email: invite.email,
    tipo_usuario: "cliente",
  });

  // 4. Add to workspace_members
  await supabase.from("workspace_members").insert({
    workspace_id: invite.workspace_id,
    user_id: userId,
    papel: invite.papel,
  });

  // 5. Mark invite as accepted
  await supabase
    .from("workspace_invites")
    .update({ aceito_em: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
