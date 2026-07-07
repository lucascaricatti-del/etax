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
import { parseParcelas, consolidarFormaPgto } from "@/lib/parcelas";

/** Validate that workspace config has all required fields including CPFs */
function validateConfig(wsConfig: Record<string, unknown>): string | null {
  const missing: string[] = [];

  if (!wsConfig.contratada_nome) missing.push("Nome da contratada");
  if (!wsConfig.contratada_email) missing.push("E-mail da contratada");
  if (!wsConfig.contratada_cpf) missing.push("CPF da contratada");
  if (!wsConfig.testemunha1_nome) missing.push("Nome da testemunha 1");
  if (!wsConfig.testemunha1_email) missing.push("E-mail da testemunha 1");
  if (!wsConfig.testemunha1_cpf) missing.push("CPF da testemunha 1");
  if (!wsConfig.testemunha2_nome) missing.push("Nome da testemunha 2");
  if (!wsConfig.testemunha2_email) missing.push("E-mail da testemunha 2");
  if (!wsConfig.testemunha2_cpf) missing.push("CPF da testemunha 2");

  if (missing.length > 0) {
    return `Configuração de assinatura incompleta. Faltam: ${missing.join(", ")}. Atualize em Configurações.`;
  }
  return null;
}

/**
 * POST /api/solicitacoes/[id]/gerar-contrato
 *
 * Fluxo idempotente (C2/C3):
 * 1. Validações (status, modelo, config, signatário) — só leitura.
 * 2. Checa contrato existente para a solicitação: se já finalizado, rejeita.
 * 3. Trava de status: update condicional 'aprovada' → 'gerando' (0 linhas = já em andamento).
 * 4. Insere contrato RASCUNHO no banco (UNIQUE(solicitacao_id) é a trava atômica final).
 *    Retry: rascunho órfão de tentativa anterior é reivindicado via delete condicional.
 * 5. ClickSign: envelope + documento + signatários + requirements (SEM ativar).
 * 6. Persiste chaves ClickSign no contrato e finaliza status no banco.
 * 7. ATIVAÇÃO do envelope por último — se o banco falhou, nenhum e-mail sai.
 * Falha no meio do fluxo deixa estado recuperável ('gerando' + rascunho) e o
 * mesmo botão "Gerar contrato" retenta sem duplicar contrato no banco.
 */
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

    // Só gera se status for 'aprovada' (fluxo normal) ou 'gerando' (retomada de falha anterior)
    if (!["aprovada", "gerando"].includes(solicitacao.status)) {
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

    // 3b. Validar que config está completa (nome, email, CPF de todos os signatários)
    const configError = validateConfig(wsConfig);
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 400 });
    }

    // 3c. Validar signatário contratante ANTES de travar status
    const contratanteEmail = solicitacao.dados.email as string | undefined;
    const contratanteNome = (solicitacao.dados.rep_nome as string) || (solicitacao.dados.nome as string) || contraparte.nome;
    const contratanteCpf = (solicitacao.dados.cpf as string) || null;

    if (!contratanteEmail) {
      return NextResponse.json(
        { error: "E-mail do representante/signatário não encontrado nos dados da solicitação." },
        { status: 400 }
      );
    }

    const csToken = wsConfig.clicksign_token;

    // ---------------------------------------------------------------
    // C2: Idempotência — contrato existente + trava de status + rascunho
    // ---------------------------------------------------------------

    // C2.3: Já existe contrato para esta solicitação?
    const { data: contratoExistente, error: errExistente } = await supabase
      .from("contratos")
      .select("id, status_assinatura")
      .eq("solicitacao_id", id)
      .maybeSingle();

    if (errExistente) {
      console.error("[GerarContrato] Erro ao checar contrato existente:", errExistente);
      return NextResponse.json(
        { error: "Não foi possível verificar contratos existentes. Tente novamente." },
        { status: 500 }
      );
    }

    if (contratoExistente && contratoExistente.status_assinatura !== "rascunho") {
      // Auto-correção: solicitação presa em 'aprovada'/'gerando' com contrato já finalizado
      if (solicitacao.status !== "enviada_assinatura") {
        await supabase
          .from("solicitacoes")
          .update({ status: "enviada_assinatura" })
          .eq("id", id);
      }
      return NextResponse.json(
        { error: "Já existe um contrato gerado para esta solicitação." },
        { status: 409 }
      );
    }

    // C2.2: Trava de transição — 'aprovada' → 'gerando' (só 1 requisição passa)
    if (solicitacao.status === "aprovada") {
      const { data: locked, error: errLock } = await supabase
        .from("solicitacoes")
        .update({ status: "gerando" })
        .eq("id", id)
        .eq("status", "aprovada")
        .select("id");

      if (errLock) {
        console.error("[GerarContrato] Erro ao travar status:", errLock);
        return NextResponse.json(
          { error: "Não foi possível iniciar a geração. Tente novamente." },
          { status: 500 }
        );
      }

      if (!locked || locked.length !== 1) {
        return NextResponse.json(
          { error: "Geração já em andamento para esta solicitação. Aguarde alguns instantes e atualize a página." },
          { status: 409 }
        );
      }
    } else {
      // status === 'gerando': retomada de tentativa anterior que falhou no meio.
      // A exclusividade é garantida pelo claim do rascunho + UNIQUE(solicitacao_id) abaixo.
      console.log("[GerarContrato] Retomando geração após falha anterior. Solicitação:", id);
    }

    // C2.1 + retry: reivindicar rascunho órfão (delete condicional = claim atômico)
    if (contratoExistente) {
      const { data: claimed, error: errClaim } = await supabase
        .from("contratos")
        .delete()
        .eq("id", contratoExistente.id)
        .eq("status_assinatura", "rascunho")
        .select("id");

      if (errClaim) {
        console.error("[GerarContrato] Erro ao reivindicar rascunho:", errClaim);
        return NextResponse.json(
          { error: "Não foi possível retomar a geração. Tente novamente." },
          { status: 500 }
        );
      }

      if (!claimed || claimed.length !== 1) {
        return NextResponse.json(
          { error: "Geração já em andamento para esta solicitação. Aguarde alguns instantes e atualize a página." },
          { status: 409 }
        );
      }
    }

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

    // C3: Persistir contrato RASCUNHO no banco ANTES do ClickSign.
    // UNIQUE(solicitacao_id) garante que só 1 requisição consegue inserir.
    const { data: draft, error: errDraft } = await supabase
      .from("contratos")
      .insert({
        solicitacao_id: id,
        contraparte_id: contraparte.id,
        tipo: tipoContrato.slug,
        valor: valorNumeric,
        status_assinatura: "rascunho" as const,
        workspace_id: solicitacao.workspace_id,
        modelo_id: solicitacao.modelo_id,
      })
      .select("id")
      .single();

    if (errDraft || !draft) {
      if (errDraft?.code === "23505") {
        // Outra requisição inseriu primeiro (constraint UNIQUE)
        return NextResponse.json(
          { error: "Geração já em andamento para esta solicitação. Aguarde alguns instantes e atualize a página." },
          { status: 409 }
        );
      }
      console.error("[GerarContrato] Erro ao criar rascunho do contrato:", {
        message: errDraft?.message,
        details: errDraft?.details,
        hint: errDraft?.hint,
        code: errDraft?.code,
      });
      return NextResponse.json(
        { error: "Não foi possível iniciar a geração do contrato. Tente novamente." },
        { status: 500 }
      );
    }

    const draftId = draft.id as string;

    /** Limpeza best-effort quando o ClickSign falha antes da ativação:
     *  remove o rascunho e devolve a solicitação para 'aprovada'.
     *  Se a limpeza falhar, o estado 'gerando' + rascunho é retomável pelo retry. */
    async function cleanupDraft() {
      await supabase
        .from("contratos")
        .delete()
        .eq("id", draftId)
        .eq("status_assinatura", "rascunho");
      await supabase
        .from("solicitacoes")
        .update({ status: "aprovada" })
        .eq("id", id)
        .eq("status", "gerando");
    }

    // 4. Preparar dados do template (keys minúsculas → MAIÚSCULAS)
    const schemaForFormat = (tipoContrato.schema_campos ?? []) as Array<{ key: string; type?: string }>;
    const dadosForClickSign = formatDadosForClickSign(solicitacao.dados, schemaForFormat);

    // Parcelamento flexível (Club): consolida as parcelas num texto único para
    // a variável FORMA_PGTO do modelo (Opção A — modelo ClickSign não muda).
    // Só ocorre quando dados.parcelas é um array (Tração usa 'parcelas' numérico).
    const parcelasFlex = parseParcelas(solicitacao.dados.parcelas);
    if (parcelasFlex.length > 0) {
      dadosForClickSign.forma_pgto = consolidarFormaPgto(parcelasFlex);
      delete dadosForClickSign.parcelas;
    }

    const templateData = toTemplateData(dadosForClickSign);
    const envelopeName = `${tipoContrato.nome} — ${contraparte.nome}`;
    const filename = slugifyFilename(
      `${tipoContrato.slug || tipoContrato.nome}-${contraparte.nome}`
    );

    console.log("[GerarContrato] Iniciando fluxo ClickSign... Rascunho:", draftId);

    // --- ClickSign Flow (usando token da empresa) — SEM ativação ---
    let envelopeId: string;
    let documentId: string;

    try {
      // Step 1: Criar envelope
      envelopeId = await createEnvelope(envelopeName, csToken);
      console.log("[GerarContrato] Envelope criado:", envelopeId);

      // Step 2: Adicionar documento via template
      documentId = await addTemplateDocument(
        envelopeId,
        filename,
        modelo.clicksign_template_key,
        templateData,
        csToken
      );
      console.log("[GerarContrato] Documento adicionado:", documentId);

      // Step 3: Adicionar signatários (4 papéis) com CPF (documentation)

      // 3a. CONTRATANTE (representante legal da contraparte — assina manual)
      const contratanteId = await addSigner(
        envelopeId, contratanteNome, contratanteEmail, csToken,
        contratanteCpf || undefined
      );
      console.log("[GerarContrato] Contratante adicionado:", contratanteId, "CPF:", contratanteCpf ? "sim" : "não informado");

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
        csToken,
        wsConfig.contratada_cpf
      );
      console.log("[GerarContrato] Contratada adicionada:", contratadaId, "auto:", wsConfig.contratada_auto);

      if (wsConfig.contratada_auto) {
        // Assinatura automática — requer Termo de Autorização prévio na ClickSign
        try {
          await addRequirement(envelopeId, documentId, contratadaId, "provide_evidence", {
            auth: "auto_signature",
          }, csToken);
          console.log("[GerarContrato] Contratada configurada com assinatura automática (auto_signature)");
        } catch (autoErr) {
          console.error("[GerarContrato] Erro ao configurar assinatura automática:", autoErr);
          console.error("[GerarContrato] INSTRUÇÃO: O signatário precisa ter assinado o Termo de Assinatura Automática na ClickSign.");
          console.error("[GerarContrato] Acesse o painel da ClickSign > Assinatura Automática > Envie o termo para:", wsConfig.contratada_email);
          throw new Error(
            `Falha ao configurar assinatura automática para ${wsConfig.contratada_nome}. ` +
              `Verifique se o Termo de Assinatura Automática foi previamente assinado na ClickSign para o e-mail ${wsConfig.contratada_email}. ` +
              `Acesse o painel da ClickSign > Assinatura Automática para enviar o termo.`
          );
        }
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
        csToken,
        wsConfig.testemunha1_cpf
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
        csToken,
        wsConfig.testemunha2_cpf
      );
      console.log("[GerarContrato] Testemunha 2 adicionada:", test2Id);

      await addRequirement(envelopeId, documentId, test2Id, "provide_evidence", {
        auth: "email",
      }, csToken);
      await addRequirement(envelopeId, documentId, test2Id, "agree", {
        role: "witness",
      }, csToken);
    } catch (csErr) {
      // Envelope NUNCA foi ativado — nenhum e-mail saiu. Envelope inativo órfão é inofensivo.
      console.error("[GerarContrato] Falha no fluxo ClickSign (antes da ativação):", csErr);
      await cleanupDraft();
      const detail = csErr instanceof Error ? csErr.message : "Erro na comunicação com a ClickSign";
      return NextResponse.json(
        { error: `${detail} Nenhum e-mail foi enviado — você pode tentar novamente.` },
        { status: 502 }
      );
    }

    // --- C3: Persistir chaves ClickSign e finalizar no banco ANTES de ativar ---

    const { data: finalized, error: errFinalize } = await supabase
      .from("contratos")
      .update({
        status_assinatura: "aguardando_assinatura",
        clicksign_envelope_id: envelopeId,
        clicksign_document_key: documentId,
      })
      .eq("id", draftId)
      .eq("status_assinatura", "rascunho")
      .select("id");

    if (errFinalize || !finalized || finalized.length !== 1) {
      // Banco falhou → NÃO ativa o envelope. Nenhum e-mail sai.
      // Estado fica recuperável ('gerando' + rascunho) para retry.
      console.error("[GerarContrato] Erro ao finalizar contrato no banco:", {
        message: errFinalize?.message,
        details: errFinalize?.details,
        hint: errFinalize?.hint,
        code: errFinalize?.code,
        rows: finalized?.length ?? 0,
        envelopeId,
      });
      return NextResponse.json(
        { error: "Não foi possível salvar o contrato no banco. Nenhum e-mail foi enviado — tente novamente em instantes." },
        { status: 500 }
      );
    }

    // Atualizar status da solicitação (contrato já garantido no banco)
    const { error: errUpdate } = await supabase
      .from("solicitacoes")
      .update({ status: "enviada_assinatura" })
      .eq("id", id);

    if (errUpdate) {
      // Não bloqueia: contrato é a fonte da verdade; próximo clique auto-corrige o status.
      console.error("[GerarContrato] Erro ao atualizar solicitação:", errUpdate);
    }

    // --- ATIVAÇÃO por último: só dispara e-mails com o banco garantido ---
    try {
      await activateEnvelope(envelopeId, csToken);
      console.log("[GerarContrato] Envelope ativado (running)");
    } catch (actErr) {
      // Reverter para estado recuperável: rascunho + 'gerando'. Retry cria envelope novo;
      // o envelope atual nunca foi ativado (sem e-mails) e fica órfão inativo na ClickSign.
      console.error("[GerarContrato] Falha ao ativar envelope:", actErr, "Envelope:", envelopeId);
      await supabase
        .from("contratos")
        .update({
          status_assinatura: "rascunho",
          clicksign_envelope_id: null,
          clicksign_document_key: null,
        })
        .eq("id", draftId);
      await supabase
        .from("solicitacoes")
        .update({ status: "gerando" })
        .eq("id", id);
      return NextResponse.json(
        { error: "Falha ao ativar o envelope na ClickSign. Nenhum e-mail foi enviado — clique em 'Gerar contrato' para tentar novamente." },
        { status: 502 }
      );
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
