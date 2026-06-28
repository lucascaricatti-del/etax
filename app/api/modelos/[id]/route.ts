import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json({ error: "Acesso restrito à Etax" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    // Build update payload (only provided fields)
    const updateFields: Record<string, unknown> = {};
    const allowedFields = [
      "nome",
      "descricao",
      "tipo_contrato_id",
      "clicksign_template_key",
      "natureza_financeira",
      "disponibilidade",
      "variaveis",
      "schema_campos",
      "ativo",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase
        .from("modelos")
        .update(updateFields)
        .eq("id", id);

      if (error) {
        console.error("[Modelos] Erro ao atualizar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Update workspace links if workspace_ids provided
    if ("workspace_ids" in body) {
      // Delete existing links
      await supabase.from("modelo_empresas").delete().eq("modelo_id", id);

      // Insert new links
      const wsIds = body.workspace_ids as string[];
      if (wsIds?.length > 0) {
        const links = wsIds.map((wsId: string) => ({
          modelo_id: id,
          workspace_id: wsId,
        }));
        const { error: errLinks } = await supabase
          .from("modelo_empresas")
          .insert(links);
        if (errLinks) {
          console.error("[Modelos] Erro ao vincular empresas:", errLinks);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Modelos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
