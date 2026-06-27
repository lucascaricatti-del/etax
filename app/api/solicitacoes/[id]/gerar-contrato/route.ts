import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import {
  toTemplateData,
  createEnvelope,
  addTemplateDocument,
  addSigner,
  addRequirement,
  activateEnvelope,
  slugifyFilename,
} from "@/lib/clicksign";
import { formatDadosForClickSign } from "@/lib/masks";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Apenas a Etax pode gerar contratos" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Buscar solicitação com contraparte e tipo_contrato
    const { data: solicitacao, error: errSol } = await supabase
      .from("solicitacoes")
      .select("*, contraparte:contrapartes(*), tipo_contrato:tipos_contrato(*)")
      .eq("id", id)
      .single();

    if (errSol || !solicitacao) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    // Só gera se status for 'nova' ou 'em_confeccao'
    if (!["nova", "em_confeccao"].includes(solicitacao.status)) {
      return NextResponse.json(
        { error: `Solicitação com status '${solicitacao.status}' não pode gerar contrato` },
        { status: 400 }
      );
    }

    const contraparte = solicitacao.contraparte;
    const tipoContrato = solicitacao.tipo_contrato;

    if (!contraparte || !tipoContrato) {
      return NextResponse.json(
        { error: "Dados incompletos: contraparte ou tipo_contrato ausente" },
        { status: 400 }
      );
    }

    // 2. Buscar modelo ativo — preferir workspace-specific, senão padrão (null)
    const { data: modelos } = await supabase
      .from("modelos")
      .select("*")
      .eq("tipo_contrato_id", tipoContrato.id)
      .eq("ativo", true)
      .order("workspace_id", { ascending: false, nullsFirst: false });

    if (!modelos || modelos.length === 0) {
      return NextResponse.json(
        { error: "Nenhum modelo ativo para este tipo de contrato" },
        { status: 400 }
      );
    }

    // Preferir modelo do workspace, senão o padrão (workspace_id = null)
    const modelo =
      modelos.find((m) => m.workspace_id === solicitacao.workspace_id) ||
      modelos.find((m) => m.workspace_id === null) ||
      modelos[0];

    console.log("[GerarContrato] Modelo selecionado:", {
      id: modelo.id,
      templateKey: modelo.clicksign_template_key,
      workspace_id: modelo.workspace_id,
    });

    // 3. Preparar dados do template (keys minúsculas → MAIÚSCULAS)
    // Formatar valores canônicos para display legível (BRL sem R$, CNPJ com máscara, etc.)
    const schemaForFormat = (tipoContrato.schema_campos ?? []) as Array<{ key: string; type?: string }>;
    const dadosForClickSign = formatDadosForClickSign(solicitacao.dados, schemaForFormat);
    const templateData = toTemplateData(dadosForClickSign);
    const envelopeName = `${tipoContrato.nome} — ${contraparte.nome}`;
    const filename = slugifyFilename(
      `${tipoContrato.slug || tipoContrato.nome}-${contraparte.nome}`
    );

    console.log("[GerarContrato] Iniciando fluxo ClickSign...");

    // --- ClickSign Flow ---

    // Step 1: Criar envelope
    const envelopeId = await createEnvelope(envelopeName);
    console.log("[GerarContrato] Envelope criado:", envelopeId);

    // Step 2: Adicionar documento via template
    const documentId = await addTemplateDocument(
      envelopeId,
      filename,
      modelo.clicksign_template_key,
      templateData
    );
    console.log("[GerarContrato] Documento adicionado:", documentId);

    // Step 3: Adicionar signatário (contraparte)
    const signerEmail = contraparte.email;
    if (!signerEmail) {
      return NextResponse.json(
        { error: "Contraparte sem e-mail. Necessário para assinatura." },
        { status: 400 }
      );
    }

    const signerId = await addSigner(envelopeId, contraparte.nome, signerEmail);
    console.log("[GerarContrato] Signatário adicionado:", signerId);

    // Step 4a: Requirement de autenticação (e-mail)
    await addRequirement(envelopeId, documentId, signerId, "provide_evidence", {
      auth: "email",
    });
    console.log("[GerarContrato] Requirement de autenticação adicionado");

    // Step 4b: Requirement de assinatura
    await addRequirement(envelopeId, documentId, signerId, "agree", {
      role: "sign",
    });
    console.log("[GerarContrato] Requirement de assinatura adicionado");

    // Step 5: Ativar envelope
    await activateEnvelope(envelopeId);
    console.log("[GerarContrato] Envelope ativado (running)");

    // --- Persistir no banco ---

    // valor_total canônico: number (reais) ou string legada
    let valorNumeric: number | null = null;
    const rawValor = solicitacao.dados.valor_total;
    if (rawValor != null && rawValor !== "") {
      if (typeof rawValor === "number") {
        valorNumeric = rawValor;
      } else {
        // String legada — extrair dígitos e converter centavos → reais
        const digits = String(rawValor).replace(/\D/g, "");
        if (digits) valorNumeric = parseInt(digits, 10) / 100;
      }
    }

    const insertPayload = {
      solicitacao_id: id,
      contraparte_id: contraparte.id,
      tipo: tipoContrato.nome,
      valor: valorNumeric,
      status_assinatura: "aguardando_assinatura",
      status_vigencia: "pendente",
      clicksign_envelope_id: envelopeId,
      workspace_id: solicitacao.workspace_id,
    };

    console.log("[GerarContrato] Insert payload contratos:", JSON.stringify(insertPayload, null, 2));

    const { error: errContrato } = await supabase
      .from("contratos")
      .insert(insertPayload);

    if (errContrato) {
      console.error("[GerarContrato] Erro ao inserir contrato:", {
        message: errContrato.message,
        details: errContrato.details,
        hint: errContrato.hint,
        code: errContrato.code,
      });
      return NextResponse.json(
        {
          error: "Contrato criado na ClickSign mas falhou ao salvar no banco",
          clicksign_envelope_id: envelopeId,
          supabase_error: {
            message: errContrato.message,
            details: errContrato.details,
            hint: errContrato.hint,
            code: errContrato.code,
          },
        },
        { status: 500 }
      );
    }

    // Atualizar status da solicitação
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({ status: "enviada_assinatura" })
      .eq("id", id);

    if (errUpdate) {
      console.error("[GerarContrato] Erro ao atualizar solicitação:", errUpdate);
    }

    console.log("[GerarContrato] Fluxo completo. Envelope:", envelopeId);

    return NextResponse.json(
      {
        message: "Contrato gerado e enviado para assinatura",
        clicksign_envelope_id: envelopeId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[GerarContrato] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
