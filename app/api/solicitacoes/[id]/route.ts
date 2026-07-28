import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { normalizeDados } from "@/lib/masks";
import { hardDeleteContrato } from "@/lib/hard-delete";

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

      // Email da contraparte NÃO é sincronizado aqui — dados.email é do representante.
      // O email da contraparte é editado diretamente via PATCH /api/contrapartes/[id].

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

/**
 * DELETE /api/solicitacoes/[id] — exclusão DEFINITIVA (admin Etax).
 * Apaga a solicitação e, se existir, o contrato gerado a partir dela
 * (com eventos de assinatura e PDF no storage). Irreversível.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json(
        { error: "Apenas admin Etax pode excluir definitivamente" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: solicitacao, error: errSol } = await supabase
      .from("solicitacoes")
      .select("id")
      .eq("id", id)
      .single();

    if (errSol || !solicitacao) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    // Apagar primeiro o contrato vinculado (se houver), por causa da FK solicitacao_id
    const { data: contrato } = await supabase
      .from("contratos")
      .select("id, pdf_assinado_path, solicitacao_id")
      .eq("solicitacao_id", id)
      .maybeSingle();

    if (contrato) {
      await hardDeleteContrato(supabase, contrato);
    }

    const { error: errDelete } = await supabase
      .from("solicitacoes")
      .delete()
      .eq("id", id);

    if (errDelete) {
      return NextResponse.json(
        { error: "Erro ao apagar solicitação: " + errDelete.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: contrato
        ? "Solicitação e contrato vinculado excluídos definitivamente"
        : "Solicitação excluída definitivamente",
    });
  } catch (err) {
    console.error("[DELETE /api/solicitacoes/[id]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
