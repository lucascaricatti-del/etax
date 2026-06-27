import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { normalizeDados } from "@/lib/masks";

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

    // Buscar schema para normalização
    const { data: tipo } = await supabase
      .from("tipos_contrato")
      .select("schema_campos")
      .eq("id", solicitacao.tipo_contrato_id)
      .single();

    const schema = (tipo?.schema_campos ?? []) as Array<{ key: string; type?: string }>;
    const dadosNormalizados = normalizeDados(dados, schema);

    // Atualizar dados da solicitação
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({ dados: dadosNormalizados })
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

      const isPJ = Boolean(dadosNormalizados.cnpj);
      const newNome = isPJ ? dadosNormalizados.razao_social : dadosNormalizados.nome;
      if (newNome && newNome !== contraparte?.nome) {
        contraparteUpdate.nome = newNome;
      }

      const newDoc = isPJ ? dadosNormalizados.cnpj : dadosNormalizados.cpf;
      if (newDoc && newDoc !== contraparte?.cpf_cnpj) {
        contraparteUpdate.cpf_cnpj = newDoc;
      }

      const newTipoPessoa = isPJ ? "PJ" : "PF";
      if (newTipoPessoa !== contraparte?.tipo_pessoa) {
        contraparteUpdate.tipo_pessoa = newTipoPessoa;
      }

      if (dadosNormalizados.email != null && dadosNormalizados.email !== contraparte?.email) {
        contraparteUpdate.email = dadosNormalizados.email || null;
      }

      if (dadosNormalizados.whatsapp != null && dadosNormalizados.whatsapp !== contraparte?.telefone) {
        contraparteUpdate.telefone = dadosNormalizados.whatsapp || null;
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
