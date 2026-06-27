import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

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

    // Validate required fields from schema
    const schema = tipo.schema_campos as Array<{
      key: string;
      required: boolean;
    }>;
    const missing = schema
      .filter((c) => c.required && !dados[c.key])
      .map((c) => c.key);

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatórios faltando: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Upsert contraparte by cpf_cnpj
    const { data: contraparte, error: contraparteError } = await supabase
      .from("contrapartes")
      .upsert(
        {
          nome: dados.nome,
          cpf_cnpj: dados.cpf,
          tipo_pessoa: "PF",
          email: dados.email || null,
          telefone: dados.whatsapp || null,
          workspace_id: resolvedWorkspaceId,
        },
        { onConflict: "cpf_cnpj" }
      )
      .select("id")
      .single();

    if (contraparteError || !contraparte) {
      return NextResponse.json(
        { error: "Erro ao criar contraparte: " + contraparteError?.message },
        { status: 500 }
      );
    }

    // Insert solicitacao with workspace_id + solicitante
    const { data: solicitacao, error: solicitacaoError } = await supabase
      .from("solicitacoes")
      .insert({
        tipo_contrato_id,
        contraparte_id: contraparte.id,
        workspace_id: resolvedWorkspaceId,
        solicitante_id: sessao.user.id,
        status: "nova",
        dados,
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
