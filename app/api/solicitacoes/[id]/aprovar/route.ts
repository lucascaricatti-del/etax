import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem aprovar solicitações" },
        { status: 403 }
      );
    }

    const { id } = await params;
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
        { error: `Solicitação com status '${solicitacao.status}' não pode ser aprovada` },
        { status: 400 }
      );
    }

    // Approve
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({
        status: "aprovada",
        aprovado_por: sessao.user.id,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", id);

    if (errUpdate) {
      console.error("[Aprovar] Erro ao atualizar:", errUpdate);
      return NextResponse.json(
        { error: "Erro ao aprovar solicitação" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Solicitação aprovada" });
  } catch (err) {
    console.error("[Aprovar] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
