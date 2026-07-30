import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  // Etax convida em qualquer workspace; cliente só no próprio
  const isMember = sessao.workspaceIds.includes(workspaceId);
  if (!sessao.isEtax && !isMember) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { email, papel } = body;

  if (!email || !papel) {
    return NextResponse.json(
      { error: "E-mail e papel são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify workspace exists
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: "Empresa não encontrada" },
      { status: 404 }
    );
  }

  // Generate token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId,
    email,
    papel,
    token,
    criado_por: sessao.user.id,
    expira_em: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: "Erro ao criar convite: " + error.message },
      { status: 500 }
    );
  }

  const headersList = await headers();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (() => {
      const h = headersList.get("host") ?? "localhost:3000";
      return `${h.startsWith("localhost") ? "http" : "https"}://${h}`;
    })();
  const link = `${appUrl}/aceitar-convite?token=${token}`;

  return NextResponse.json({ link }, { status: 201 });
}
