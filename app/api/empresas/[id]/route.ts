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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // Check for active contracts before deleting
    const { count: activeContratos } = await supabase
      .from("contratos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", id)
      .in("status_assinatura", ["aguardando_assinatura", "assinado"])
      .is("excluido_em", null);

    if (activeContratos && activeContratos > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${activeContratos} contrato(s) ativo(s) vinculado(s).` },
        { status: 409 }
      );
    }

    // Soft delete: deactivate the workspace
    const { error } = await supabase
      .from("workspaces")
      .update({ ativo: false })
      .eq("id", id);

    if (error) {
      console.error("[Empresas] Erro ao excluir:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Empresas] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
