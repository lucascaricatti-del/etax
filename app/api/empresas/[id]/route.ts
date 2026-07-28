import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { hardDeleteContrato } from "@/lib/hard-delete";

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

/**
 * DELETE /api/empresas/[id] — exclusão DEFINITIVA da empresa (admin Etax).
 * Apaga em cascata: contratos (com eventos + PDFs), solicitações, contrapartes,
 * modelos específicos da empresa, convites, membros e config ClickSign.
 * Bloqueia se houver contratos ativos (aguardando assinatura ou assinados).
 * Irreversível.
 */
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

    const { data: workspace, error: errWs } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", id)
      .single();

    if (errWs || !workspace) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 }
      );
    }

    // Guard: contratos ativos impedem a exclusão (exclua-os individualmente antes)
    const { count: activeContratos } = await supabase
      .from("contratos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", id)
      .in("status_assinatura", ["aguardando_assinatura", "assinado"])
      .is("excluido_em", null);

    if (activeContratos && activeContratos > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: ${activeContratos} contrato(s) ativo(s) vinculado(s). Exclua os contratos primeiro.`,
        },
        { status: 409 }
      );
    }

    // 1. Apagar todos os contratos do workspace (eventos + PDF + registro)
    const { data: contratos, error: errContratos } = await supabase
      .from("contratos")
      .select("id, pdf_assinado_path, solicitacao_id")
      .eq("workspace_id", id);

    if (errContratos) {
      return NextResponse.json(
        { error: "Erro ao listar contratos: " + errContratos.message },
        { status: 500 }
      );
    }

    for (const contrato of contratos ?? []) {
      await hardDeleteContrato(supabase, contrato);
    }

    // 2. Apagar solicitações (antes das contrapartes, por causa da FK contraparte_id)
    const { error: errSol } = await supabase
      .from("solicitacoes")
      .delete()
      .eq("workspace_id", id);

    if (errSol) {
      return NextResponse.json(
        { error: "Erro ao apagar solicitações: " + errSol.message },
        { status: 500 }
      );
    }

    // 3. Apagar contrapartes
    const { error: errContrapartes } = await supabase
      .from("contrapartes")
      .delete()
      .eq("workspace_id", id);

    if (errContrapartes) {
      return NextResponse.json(
        { error: "Erro ao apagar contrapartes: " + errContrapartes.message },
        { status: 500 }
      );
    }

    // 4. Apagar vínculos e modelos específicos da empresa
    const { error: errLinks } = await supabase
      .from("modelo_empresas")
      .delete()
      .eq("workspace_id", id);

    if (errLinks) {
      return NextResponse.json(
        { error: "Erro ao apagar vínculos de modelos: " + errLinks.message },
        { status: 500 }
      );
    }

    const { error: errModelos } = await supabase
      .from("modelos")
      .delete()
      .eq("workspace_id", id);

    if (errModelos) {
      return NextResponse.json(
        { error: "Erro ao apagar modelos da empresa: " + errModelos.message },
        { status: 500 }
      );
    }

    // 5. Apagar convites, membros e config ClickSign
    for (const table of [
      "workspace_invites",
      "workspace_members",
      "workspace_clicksign_config",
    ] as const) {
      const { error: errTable } = await supabase
        .from(table)
        .delete()
        .eq("workspace_id", id);

      if (errTable) {
        return NextResponse.json(
          { error: `Erro ao apagar ${table}: ` + errTable.message },
          { status: 500 }
        );
      }
    }

    // 6. Apagar o workspace
    const { error: errDelete } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", id);

    if (errDelete) {
      console.error("[Empresas] Erro ao excluir workspace:", errDelete);
      return NextResponse.json({ error: errDelete.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Empresa excluída definitivamente",
    });
  } catch (err) {
    console.error("[Empresas] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
