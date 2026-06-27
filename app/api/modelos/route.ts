import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Acesso restrito à Etax" },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const tipoContratoId = searchParams.get("tipo_contrato_id");
    const workspaceId = searchParams.get("workspace_id");

    const supabase = createAdminClient();

    let query = supabase
      .from("modelos")
      .select("id, nome, descricao, versao, tipo_contrato_id, workspace_id, ativo, clicksign_template_key")
      .eq("ativo", true)
      .order("versao", { ascending: false });

    if (tipoContratoId) {
      query = query.eq("tipo_contrato_id", tipoContratoId);
    }

    // Scope: workspace-specific + default (null)
    if (workspaceId) {
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Modelos] Erro ao listar:", error);
      return NextResponse.json({ error: "Erro ao listar modelos" }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[Modelos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
