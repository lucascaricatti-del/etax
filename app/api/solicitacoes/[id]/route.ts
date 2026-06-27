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
      return NextResponse.json(
        { error: "Apenas a Etax pode editar solicitações" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { dados } = body;

    if (!dados || typeof dados !== "object") {
      return NextResponse.json(
        { error: "Campo 'dados' é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar solicitação atual com contraparte
    const { data: solicitacao, error: errSol } = await supabase
      .from("solicitacoes")
      .select("*, contraparte:contrapartes(*)")
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
        { error: `Solicitação com status '${solicitacao.status}' não pode ser editada` },
        { status: 400 }
      );
    }

    // Atualizar dados da solicitação
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({ dados })
      .eq("id", id);

    if (errUpdate) {
      return NextResponse.json(
        { error: "Erro ao atualizar solicitação: " + errUpdate.message },
        { status: 500 }
      );
    }

    // Sincronizar contraparte se campos relevantes mudaram
    if (solicitacao.contraparte_id) {
      const contraparte = solicitacao.contraparte;
      const contraparteUpdate: Record<string, unknown> = {};

      // Nome: PJ usa razao_social, PF usa nome
      const isPJ = Boolean(dados.cnpj);
      const newNome = isPJ ? dados.razao_social : dados.nome;
      if (newNome && newNome !== contraparte?.nome) {
        contraparteUpdate.nome = newNome;
      }

      // Documento
      const newDoc = isPJ ? dados.cnpj : dados.cpf;
      if (newDoc && newDoc !== contraparte?.cpf_cnpj) {
        contraparteUpdate.cpf_cnpj = newDoc;
      }

      // Tipo pessoa
      const newTipoPessoa = isPJ ? "PJ" : "PF";
      if (newTipoPessoa !== contraparte?.tipo_pessoa) {
        contraparteUpdate.tipo_pessoa = newTipoPessoa;
      }

      // Email
      if (dados.email != null && dados.email !== contraparte?.email) {
        contraparteUpdate.email = dados.email || null;
      }

      // Telefone (whatsapp)
      if (dados.whatsapp != null && dados.whatsapp !== contraparte?.telefone) {
        contraparteUpdate.telefone = dados.whatsapp || null;
      }

      if (Object.keys(contraparteUpdate).length > 0) {
        const { error: errContraparte } = await supabase
          .from("contrapartes")
          .update(contraparteUpdate)
          .eq("id", solicitacao.contraparte_id);

        if (errContraparte) {
          console.error(
            "[PATCH solicitacao] Erro ao atualizar contraparte:",
            errContraparte
          );
        }
      }
    }

    return NextResponse.json({ message: "Solicitação atualizada" });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
