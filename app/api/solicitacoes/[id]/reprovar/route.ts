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

    if (!sessao.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem reprovar solicitações" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { motivo } = body;

    if (!motivo || typeof motivo !== "string" || motivo.trim().length === 0) {
      return NextResponse.json(
        { error: "Motivo da reprovação é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validate solicitação exists and has correct status
    const { data: solicitacao, error: errSol } = await supabase
      .from("solicitacoes")
      .select("id, status")
      .eq("id", id)
      .single();

    if (errSol || !solicitacao) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    if (solicitacao.status !== "aguardando_aprovacao") {
      return NextResponse.json(
        { error: `Solicitação com status '${solicitacao.status}' não pode ser reprovada` },
        { status: 400 }
      );
    }

    // Reject: status back to em_confeccao, clear modelo_id, save reason
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({
        status: "em_confeccao",
        modelo_id: null,
        motivo_reprovacao: motivo.trim(),
      })
      .eq("id", id);

    if (errUpdate) {
      console.error("[Reprovar] Erro ao atualizar:", errUpdate);
      return NextResponse.json(
        { error: "Erro ao reprovar solicitação" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Solicitação reprovada" });
  } catch (err) {
    console.error("[Reprovar] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
