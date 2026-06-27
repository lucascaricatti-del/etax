import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { normalizeDados } from "@/lib/masks";

export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { tipo_contrato_id, dados, workspace_id } = body;

    if (!tipo_contrato_id || !dados) {
      return NextResponse.json(
        { error: "tipo_contrato_id e dados são obrigatórios" },
        { status: 400 }
      );
    }

    // Resolve workspace_id — security: cliente never creates for another workspace
    let resolvedWorkspaceId: string;

    if (sessao.isEtax) {
      if (!workspace_id) {
        return NextResponse.json(
          { error: "Selecione a empresa para a solicitação" },
          { status: 400 }
        );
      }
      resolvedWorkspaceId = workspace_id;
    } else {
      // Cliente: always use their own workspace, ignore any workspace_id in payload
      if (sessao.workspaceIds.length === 0) {
        return NextResponse.json(
          { error: "Usuário não pertence a nenhum workspace" },
          { status: 403 }
        );
      }
      resolvedWorkspaceId = sessao.workspaceIds[0];
    }

    const supabase = createAdminClient();

    // Validate tipo_contrato exists
    const { data: tipo, error: tipoError } = await supabase
      .from("tipos_contrato")
      .select("id, schema_campos")
      .eq("id", tipo_contrato_id)
      .single();

    if (tipoError || !tipo) {
      return NextResponse.json(
        { error: "Tipo de contrato não encontrado" },
        { status: 404 }
      );
    }

    // Normalizar dados para forma canônica antes de validar/salvar
    const schema = tipo.schema_campos as Array<{
      key: string;
      type?: string;
      required: boolean;
    }>;
    const dadosNormalizados = normalizeDados(dados, schema);

    const missing = schema
      .filter((c) => {
        const v = dadosNormalizados[c.key];
        return c.required && (v == null || v === "" || v === 0);
      })
      .map((c) => c.key);

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatórios faltando: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Resolve contraparte — PJ se tem cnpj, PF se tem cpf
    const isPJ = Boolean(dadosNormalizados.cnpj);
    const doc: string | null = (isPJ ? dadosNormalizados.cnpj : dadosNormalizados.cpf) as string | null;
    const nomeContraparte = isPJ ? dadosNormalizados.razao_social : dadosNormalizados.nome;
    const tipoPessoa = isPJ ? "PJ" : "PF";

    let contraparteId: string;

    if (doc) {
      // Tenta achar contraparte existente pelo documento neste workspace
      const { data: existente } = await supabase
        .from("contrapartes")
        .select("id")
        .eq("workspace_id", resolvedWorkspaceId)
        .eq("cpf_cnpj", doc)
        .maybeSingle();

      if (existente) {
        contraparteId = existente.id;
      } else {
        const { data: nova, error: errNova } = await supabase
          .from("contrapartes")
          .insert({
            nome: nomeContraparte,
            cpf_cnpj: doc,
            tipo_pessoa: tipoPessoa,
            email: null,
            telefone: dadosNormalizados.whatsapp || null,
            workspace_id: resolvedWorkspaceId,
          })
          .select("id")
          .single();

        if (errNova || !nova) {
          return NextResponse.json(
            { error: "Erro ao criar contraparte: " + errNova?.message },
            { status: 500 }
          );
        }
        contraparteId = nova.id;
      }
    } else {
      // Sem documento — insere direto sem tentar casar
      const { data: nova, error: errNova } = await supabase
        .from("contrapartes")
        .insert({
          nome: nomeContraparte,
          cpf_cnpj: null,
          tipo_pessoa: tipoPessoa,
          email: null,
          telefone: dadosNormalizados.whatsapp || null,
          workspace_id: resolvedWorkspaceId,
        })
        .select("id")
        .single();

      if (errNova || !nova) {
        return NextResponse.json(
          { error: "Erro ao criar contraparte: " + errNova?.message },
          { status: 500 }
        );
      }
      contraparteId = nova.id;
    }

    // Insert solicitacao with workspace_id + solicitante
    const { data: solicitacao, error: solicitacaoError } = await supabase
      .from("solicitacoes")
      .insert({
        tipo_contrato_id,
        contraparte_id: contraparteId,
        workspace_id: resolvedWorkspaceId,
        solicitante_id: sessao.user.id,
        status: "nova",
        dados: dadosNormalizados,
      })
      .select("id")
      .single();

    if (solicitacaoError) {
      return NextResponse.json(
        { error: "Erro ao criar solicitação: " + solicitacaoError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { id: solicitacao.id, message: "Solicitação criada com sucesso" },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
