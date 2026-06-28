import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isEtax) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const updateFields: Record<string, unknown> = {};
    const allowedFields = ["nome", "nome_fantasia", "cnpj", "ativo"];

    for (const field of allowedFields) {
      if (field in body) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("workspaces")
      .update(updateFields)
      .eq("id", id);

    if (error) {
      console.error("[Empresas] Erro ao atualizar:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Empresas] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
