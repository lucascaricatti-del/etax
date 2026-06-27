import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Apenas a Etax pode enviar para aprovação" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { modelo_id } = body;

    if (!modelo_id) {
      return NextResponse.json(
        { error: "modelo_id é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validate solicitação exists and has correct status
    const { data: solicitacao, error: errSol } = await supabase
      .from("solicitacoes")
      .select("id, status, tipo_contrato_id, workspace_id")
      .eq("id", id)
      .single();

    if (errSol || !solicitacao) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    if (!["nova", "em_confeccao"].includes(solicitacao.status)) {
      return NextResponse.json(
        { error: `Solicitação com status '${solicitacao.status}' não pode ser enviada para aprovação` },
        { status: 400 }
      );
    }

    // Validate modelo exists, is active, and matches tipo_contrato
    const { data: modelo, error: errModelo } = await supabase
      .from("modelos")
      .select("id, tipo_contrato_id, ativo, workspace_id")
      .eq("id", modelo_id)
      .single();

    if (errModelo || !modelo) {
      return NextResponse.json(
        { error: "Modelo não encontrado" },
        { status: 404 }
      );
    }

    if (!modelo.ativo) {
      return NextResponse.json(
        { error: "Modelo inativo" },
        { status: 400 }
      );
    }

    if (modelo.tipo_contrato_id !== solicitacao.tipo_contrato_id) {
      return NextResponse.json(
        { error: "Modelo não corresponde ao tipo de contrato da solicitação" },
        { status: 400 }
      );
    }

    // Update solicitação
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({
        modelo_id,
        status: "aguardando_aprovacao",
        motivo_reprovacao: null,
      })
      .eq("id", id);

    if (errUpdate) {
      console.error("[EnviarAprovacao] Erro ao atualizar:", errUpdate);
      return NextResponse.json(
        { error: "Erro ao enviar para aprovação" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Enviada para aprovação" });
  } catch (err) {
    console.error("[EnviarAprovacao] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
