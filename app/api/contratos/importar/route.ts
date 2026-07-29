import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export const maxDuration = 60;

interface ImportPayload {
  workspace_id: string;
  tipo: string;
  modelo_id?: string | null;
  nome: string;
  cpf_cnpj: string;
  email?: string | null;
  telefone?: string | null;
  valor?: number | null;
  assinado_em?: string | null; // YYYY-MM-DD
  vigencia_inicio?: string | null; // YYYY-MM-DD
  vigencia_fim?: string | null; // YYYY-MM-DD
}

/**
 * POST /api/contratos/importar — importa contrato antigo (já assinado fora do
 * sistema). Admin Etax. FormData: file (PDF) + payload (JSON, ImportPayload).
 *
 * 1. Reusa contraparte por cpf_cnpj no workspace (ou cria).
 * 2. Insere contrato com status 'assinado' (principal, conta no dashboard).
 * 3. Sobe o PDF no bucket contratos-assinados e grava pdf_assinado_path.
 */
export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const payloadRaw = formData.get("payload");

    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Arquivo PDF é obrigatório" },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF muito grande (máximo 4MB)" },
        { status: 400 }
      );
    }

    if (typeof payloadRaw !== "string") {
      return NextResponse.json(
        { error: "Dados do contrato ausentes" },
        { status: 400 }
      );
    }

    let payload: ImportPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json(
        { error: "Dados do contrato inválidos" },
        { status: 400 }
      );
    }

    const nome = payload.nome?.trim();
    const cpfCnpj = payload.cpf_cnpj?.trim();

    if (!payload.workspace_id || !payload.tipo || !nome || !cpfCnpj) {
      return NextResponse.json(
        { error: "Empresa, tipo, nome e CPF/CNPJ da contraparte são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validar workspace
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", payload.workspace_id)
      .single();

    if (!workspace) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 400 }
      );
    }

    // 1. Contraparte: reusa por documento no workspace, senão cria
    const docDigits = cpfCnpj.replace(/\D/g, "");
    const tipoPessoa = docDigits.length > 11 ? "PJ" : "PF";

    const { data: contrapartesWs } = await supabase
      .from("contrapartes")
      .select("id, cpf_cnpj")
      .eq("workspace_id", payload.workspace_id);

    let contraparteId = (contrapartesWs ?? []).find(
      (c) => (c.cpf_cnpj ?? "").replace(/\D/g, "") === docDigits
    )?.id;

    if (!contraparteId) {
      const { data: novaContraparte, error: errContraparte } = await supabase
        .from("contrapartes")
        .insert({
          workspace_id: payload.workspace_id,
          nome,
          cpf_cnpj: cpfCnpj,
          tipo_pessoa: tipoPessoa,
          email: payload.email?.trim() || null,
          telefone: payload.telefone?.trim() || null,
        })
        .select("id")
        .single();

      if (errContraparte || !novaContraparte) {
        return NextResponse.json(
          { error: "Erro ao criar contraparte: " + (errContraparte?.message ?? "") },
          { status: 500 }
        );
      }
      contraparteId = novaContraparte.id;
    }

    // 2. Inserir contrato como assinado (meio-dia UTC evita virada de mês por fuso)
    const assinadoEm = payload.assinado_em
      ? `${payload.assinado_em}T12:00:00.000Z`
      : new Date().toISOString();

    const { data: contrato, error: errContrato } = await supabase
      .from("contratos")
      .insert({
        contraparte_id: contraparteId,
        workspace_id: payload.workspace_id,
        tipo: payload.tipo,
        valor: payload.valor ?? null,
        status_assinatura: "assinado",
        assinado_em: assinadoEm,
        vigencia_inicio: payload.vigencia_inicio || null,
        vigencia_fim: payload.vigencia_fim || null,
        modelo_id: payload.modelo_id || null,
      })
      .select("id")
      .single();

    if (errContrato || !contrato) {
      return NextResponse.json(
        { error: "Erro ao criar contrato: " + (errContrato?.message ?? "") },
        { status: 500 }
      );
    }

    // 3. Upload do PDF no storage (mesmo path do fluxo ClickSign)
    const storagePath = `${contrato.id}.pdf`;
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const { error: errUpload } = await supabase.storage
      .from("contratos-assinados")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (errUpload) {
      console.error("[Importar] Contrato criado mas upload do PDF falhou:", errUpload);
      return NextResponse.json({
        id: contrato.id,
        message:
          "Contrato importado, mas o upload do PDF falhou. Tente importar novamente ou anexe depois.",
      });
    }

    const { error: errPath } = await supabase
      .from("contratos")
      .update({ pdf_assinado_path: storagePath })
      .eq("id", contrato.id);

    if (errPath) {
      console.error("[Importar] Erro ao gravar pdf_assinado_path:", errPath);
    }

    return NextResponse.json(
      { id: contrato.id, message: "Contrato importado com sucesso" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Importar] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
