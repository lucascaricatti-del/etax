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

    // Só gera se status for 'aprovada'
    if (solicitacao.status !== "aprovada") {
      return NextResponse.json(
        { error: `Solicitação com status '${solicitacao.status}' não pode gerar contrato. É necessário aprovação.` },
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

    // 2. Usar modelo pré-selecionado na aprovação
    if (!solicitacao.modelo_id) {
      return NextResponse.json(
        { error: "Modelo não selecionado. Envie para aprovação primeiro." },
        { status: 400 }
      );
    }

    const { data: modelo, error: errModelo } = await supabase
      .from("modelos")
      .select("*")
      .eq("id", solicitacao.modelo_id)
      .single();

    if (errModelo || !modelo) {
      return NextResponse.json(
        { error: "Modelo selecionado não encontrado" },
        { status: 400 }
      );
    }

    // 3. Buscar config de assinatura da empresa
    if (!solicitacao.workspace_id) {
      return NextResponse.json(
        { error: "Solicitação sem workspace_id. Não é possível determinar a config de assinatura." },
        { status: 400 }
      );
    }

    const { data: wsConfig, error: errConfig } = await supabase
      .from("workspace_clicksign_config")
      .select("*")
      .eq("workspace_id", solicitacao.workspace_id)
      .maybeSingle();

    if (errConfig) {
      console.error("[GerarContrato] Erro ao buscar config:", errConfig);
    }

    if (!wsConfig) {
      return NextResponse.json(
        { error: "Configuração de assinatura não encontrada para esta empresa. Configure em /configuracoes." },
        { status: 400 }
      );
    }

    const csToken = wsConfig.clicksign_token;

    console.log("[GerarContrato] Modelo selecionado:", {
      id: modelo.id,
      templateKey: modelo.clicksign_template_key,
    });
    console.log("[GerarContrato] Config da empresa:", {
      workspace_id: wsConfig.workspace_id,
      contratada: wsConfig.contratada_nome,
      contratada_auto: wsConfig.contratada_auto,
      testemunha1: wsConfig.testemunha1_nome,
      testemunha2: wsConfig.testemunha2_nome,
    });

    // 4. Preparar dados do template (keys minúsculas → MAIÚSCULAS)
    const schemaForFormat = (tipoContrato.schema_campos ?? []) as Array<{ key: string; type?: string }>;
    const dadosForClickSign = formatDadosForClickSign(solicitacao.dados, schemaForFormat);
    const templateData = toTemplateData(dadosForClickSign);
    const envelopeName = `${tipoContrato.nome} — ${contraparte.nome}`;
    const filename = slugifyFilename(
      `${tipoContrato.slug || tipoContrato.nome}-${contraparte.nome}`
    );

    console.log("[GerarContrato] Iniciando fluxo ClickSign...");

    // --- ClickSign Flow (usando token da empresa) ---

    // Step 1: Criar envelope
    const envelopeId = await createEnvelope(envelopeName, csToken);
    console.log("[GerarContrato] Envelope criado:", envelopeId);

    // Step 2: Adicionar documento via template
    const documentId = await addTemplateDocument(
      envelopeId,
      filename,
      modelo.clicksign_template_key,
      templateData,
      csToken
    );
    console.log("[GerarContrato] Documento adicionado:", documentId);

    // ---------------------------------------------------------------
    // Step 3: Adicionar signatários (4 papéis)
    // ---------------------------------------------------------------

    // 3a. CONTRATANTE (representante legal da contraparte — assina manual)
    const contratanteEmail = solicitacao.dados.email as string | undefined;
    const contratanteNome = (solicitacao.dados.rep_nome as string) || (solicitacao.dados.nome as string) || contraparte.nome;
    if (!contratanteEmail) {
      return NextResponse.json(
        { error: "E-mail do representante/signatário não encontrado nos dados da solicitação." },
        { status: 400 }
      );
    }

    const contratanteId = await addSigner(envelopeId, contratanteNome, contratanteEmail, csToken);
    console.log("[GerarContrato] Contratante adicionado:", contratanteId);

    // Auth: e-mail
    await addRequirement(envelopeId, documentId, contratanteId, "provide_evidence", {
      auth: "email",
    }, csToken);
    // Qualificação: contratante + assinar
    await addRequirement(envelopeId, documentId, contratanteId, "agree", {
      role: "contractor",
    }, csToken);

    // 3b. CONTRATADA (representante da empresa — pode ser auto)
    const contratadaId = await addSigner(
      envelopeId,
      wsConfig.contratada_nome,
      wsConfig.contratada_email,
      csToken
    );
    console.log("[GerarContrato] Contratada adicionada:", contratadaId, "auto:", wsConfig.contratada_auto);

    if (wsConfig.contratada_auto) {
      // Assinatura automática — requer Termo de Autorização prévio na ClickSign
      await addRequirement(envelopeId, documentId, contratadaId, "provide_evidence", {
        auth: "auto_signature",
      }, csToken);
      console.log("[GerarContrato] Contratada configurada com assinatura automática (auto_signature)");
      console.log("[GerarContrato] NOTA: Requer Termo de Assinatura Automática previamente assinado na ClickSign");
    } else {
      // Assinatura manual via e-mail
      await addRequirement(envelopeId, documentId, contratadaId, "provide_evidence", {
        auth: "email",
      }, csToken);
    }
    // Qualificação: contratada
    await addRequirement(envelopeId, documentId, contratadaId, "agree", {
      role: "contractee",
    }, csToken);

    // 3c. TESTEMUNHA 1
    const test1Id = await addSigner(
      envelopeId,
      wsConfig.testemunha1_nome,
      wsConfig.testemunha1_email,
      csToken
    );
    console.log("[GerarContrato] Testemunha 1 adicionada:", test1Id);

    await addRequirement(envelopeId, documentId, test1Id, "provide_evidence", {
      auth: "email",
    }, csToken);
    await addRequirement(envelopeId, documentId, test1Id, "agree", {
      role: "witness",
    }, csToken);

    // 3d. TESTEMUNHA 2
    const test2Id = await addSigner(
      envelopeId,
      wsConfig.testemunha2_nome,
      wsConfig.testemunha2_email,
      csToken
    );
    console.log("[GerarContrato] Testemunha 2 adicionada:", test2Id);

    await addRequirement(envelopeId, documentId, test2Id, "provide_evidence", {
      auth: "email",
    }, csToken);
    await addRequirement(envelopeId, documentId, test2Id, "agree", {
      role: "witness",
    }, csToken);

    // Step 4: Ativar envelope
    await activateEnvelope(envelopeId, csToken);
    console.log("[GerarContrato] Envelope ativado (running)");

    // --- Persistir no banco ---

    // valor_total canônico: number (reais) ou string legada
    let valorNumeric: number | null = null;
    const rawValor = solicitacao.dados.valor_total;
    if (rawValor != null && rawValor !== "") {
      if (typeof rawValor === "number") {
        valorNumeric = rawValor;
      } else {
        const digits = String(rawValor).replace(/\D/g, "");
        if (digits) valorNumeric = parseInt(digits, 10) / 100;
      }
    }

    const insertPayload = {
      solicitacao_id: id,
      contraparte_id: contraparte.id,
      tipo: tipoContrato.slug,
      valor: valorNumeric,
      status_assinatura: "aguardando_assinatura" as const,
      clicksign_envelope_id: envelopeId,
      clicksign_document_key: documentId,
      workspace_id: solicitacao.workspace_id,
      modelo_id: solicitacao.modelo_id,
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
