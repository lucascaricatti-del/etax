import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // Buscar contrato com path do PDF
    const { data: contrato, error: errContrato } = await supabase
      .from("contratos")
      .select("id, pdf_assinado_path, workspace_id")
      .eq("id", id)
      .single();

    if (errContrato || !contrato) {
      return NextResponse.json(
        { error: "Contrato não encontrado" },
        { status: 404 }
      );
    }

    // Autorização: Etax vê tudo; cliente só vê do seu workspace
    if (!sessao.isEtax) {
      if (!contrato.workspace_id || !sessao.workspaceIds.includes(contrato.workspace_id)) {
        return NextResponse.json(
          { error: "Sem permissão para acessar este contrato" },
          { status: 403 }
        );
      }
    }

    if (!contrato.pdf_assinado_path) {
      return NextResponse.json(
        { error: "PDF assinado ainda não disponível" },
        { status: 404 }
      );
    }

    // Gerar URL assinada temporária (60 segundos)
    const { data: signedUrl, error: errUrl } = await supabase.storage
      .from("contratos-assinados")
      .createSignedUrl(contrato.pdf_assinado_path, 60);

    if (errUrl || !signedUrl) {
      console.error("[PDF] Erro ao gerar URL assinada:", errUrl);
      return NextResponse.json(
        { error: "Erro ao gerar link de download" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (err) {
    console.error("[PDF] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
