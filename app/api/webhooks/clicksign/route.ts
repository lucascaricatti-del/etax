import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// ClickSign Webhook — Fatia 3
//
// Recebe eventos da ClickSign, valida HMAC, registra em eventos_assinatura,
// e atualiza status_assinatura do contrato + status da solicitação.
//
// Header de assinatura: Content-Hmac: sha256=<hex>
// Algoritmo: HMAC-SHA256(body_raw, CLICKSIGN_WEBHOOK_SECRET)
//
// Eventos relevantes:
//   sign           → assinatura individual (log)
//   auto_close     → documento finalizado automaticamente → assinado
//   close          → documento finalizado manualmente → assinado
//   document_closed → documento pronto para download → assinado
//   refusal        → recusa do signatário → recusado
//   deadline       → prazo expirado → expirado
//   cancel         → cancelamento manual → expirado
// ---------------------------------------------------------------------------

/** Mapeia evento ClickSign → status_assinatura do contrato. */
function mapEventToStatus(
  eventName: string
): "assinado" | "recusado" | "expirado" | null {
  switch (eventName) {
    case "auto_close":
    case "close":
    case "document_closed":
      return "assinado";
    case "refusal":
      return "recusado";
    case "deadline":
    case "cancel":
      return "expirado";
    default:
      // sign, add_signer, upload, etc. → apenas log, sem mudança de status
      return null;
  }
}

/** Status correspondente na solicitação. */
function mapEventToSolicitacaoStatus(
  eventName: string
): string | null {
  switch (eventName) {
    case "auto_close":
    case "close":
    case "document_closed":
      return "assinada";
    case "refusal":
      return "recusada";
    case "deadline":
    case "cancel":
      return "expirada";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook ClickSign] CLICKSIGN_WEBHOOK_SECRET não configurada");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // 1. Ler body CRU para validação HMAC (antes de qualquer parse)
  const rawBody = await request.text();

  // 2. Validar HMAC
  const hmacHeader = request.headers.get("content-hmac");
  if (!hmacHeader) {
    console.warn("[Webhook ClickSign] Header Content-Hmac ausente");
    return NextResponse.json({ error: "Missing HMAC signature" }, { status: 401 });
  }

  // Formato: sha256=<hex>
  const expectedSig = hmacHeader.replace(/^sha256=/, "");
  const computedSig = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (computedSig !== expectedSig) {
    console.warn("[Webhook ClickSign] HMAC inválido", {
      expected: expectedSig.slice(0, 16) + "...",
      computed: computedSig.slice(0, 16) + "...",
    });
    return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
  }

  // 3. Parse do body
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[Webhook ClickSign] Body não é JSON válido");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event as
    | { name: string; data?: Record<string, unknown>; occurred_at?: string }
    | undefined;
  const document = payload.document as
    | { key?: string; status?: string; downloads?: Record<string, string> }
    | undefined;

  const eventName = event?.name ?? "unknown";
  const documentKey = document?.key ?? null;

  // Log do payload completo para diagnóstico
  const envelope = payload.envelope as
    | { id?: string; key?: string }
    | undefined;
  const envelopeId = envelope?.id ?? envelope?.key ?? null;

  console.log("[Webhook ClickSign] Evento recebido:", {
    event: eventName,
    document_key: documentKey,
    envelope_id: envelopeId,
    occurred_at: event?.occurred_at,
    payload_keys: Object.keys(payload),
  });
  console.log("[Webhook ClickSign] Payload completo:", JSON.stringify(payload));

  if (!documentKey && !envelopeId) {
    console.warn("[Webhook ClickSign] Evento sem document.key nem envelope.id, ignorando");
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  // 4. Buscar contrato — tentar por document_key primeiro, depois por envelope_id
  let contrato: { id: string; solicitacao_id: string | null; status_assinatura: string } | null = null;

  if (documentKey) {
    const { data } = await supabase
      .from("contratos")
      .select("id, solicitacao_id, status_assinatura")
      .eq("clicksign_document_key", documentKey)
      .maybeSingle();
    contrato = data;
  }

  if (!contrato && envelopeId) {
    const { data } = await supabase
      .from("contratos")
      .select("id, solicitacao_id, status_assinatura")
      .eq("clicksign_envelope_id", envelopeId)
      .maybeSingle();
    contrato = data;
  }

  // Fallback: tentar document_key contra envelope_id (contratos antigos sem document_key)
  if (!contrato && documentKey) {
    const { data } = await supabase
      .from("contratos")
      .select("id, solicitacao_id, status_assinatura")
      .eq("clicksign_envelope_id", documentKey)
      .maybeSingle();
    contrato = data;
  }

  // 5. Idempotência: verificar se este evento já foi processado
  const clicksignEventId =
    (event?.occurred_at as string) || new Date().toISOString();
  const dedupKey = documentKey || envelopeId!;

  const { data: existing } = await supabase
    .from("eventos_assinatura")
    .select("id")
    .eq("envelope_id", dedupKey)
    .eq("evento", eventName)
    .eq("clicksign_event_id", clicksignEventId)
    .maybeSingle();

  if (existing) {
    console.log("[Webhook ClickSign] Evento já processado, ignorando:", existing.id);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 6. Registrar evento em eventos_assinatura
  const { error: errEvento } = await supabase.from("eventos_assinatura").insert({
    contrato_id: contrato?.id ?? null,
    envelope_id: dedupKey,
    evento: eventName,
    clicksign_event_id: clicksignEventId,
    payload,
  });

  if (errEvento) {
    console.error("[Webhook ClickSign] Erro ao registrar evento:", errEvento);
  }

  // 7. Atualizar status do contrato se aplicável
  const newStatus = mapEventToStatus(eventName);

  if (contrato && newStatus) {
    const updateFields: Record<string, unknown> = {
      status_assinatura: newStatus,
    };

    if (newStatus === "assinado") {
      updateFields.assinado_em = new Date().toISOString();

      // Guardar link do documento assinado, se disponível
      const signedUrl = document?.downloads?.signed_file_url;
      if (signedUrl) {
        updateFields.link_documento = signedUrl;
      }
    }

    const { error: errContrato } = await supabase
      .from("contratos")
      .update(updateFields)
      .eq("id", contrato.id);

    if (errContrato) {
      console.error("[Webhook ClickSign] Erro ao atualizar contrato:", errContrato);
    } else {
      console.log("[Webhook ClickSign] Contrato atualizado:", {
        contrato_id: contrato.id,
        status_assinatura: newStatus,
      });
    }

    // 8. Atualizar solicitação vinculada
    const solicitacaoStatus = mapEventToSolicitacaoStatus(eventName);
    if (contrato.solicitacao_id && solicitacaoStatus) {
      const { error: errSol } = await supabase
        .from("solicitacoes")
        .update({ status: solicitacaoStatus })
        .eq("id", contrato.solicitacao_id);

      if (errSol) {
        console.error("[Webhook ClickSign] Erro ao atualizar solicitação:", errSol);
      } else {
        console.log("[Webhook ClickSign] Solicitação atualizada:", {
          solicitacao_id: contrato.solicitacao_id,
          status: solicitacaoStatus,
        });
      }
    }
  } else if (!contrato) {
    console.warn("[Webhook ClickSign] Nenhum contrato encontrado para envelope:", documentKey);
  } else {
    console.log("[Webhook ClickSign] Evento registrado, sem mudança de status:", eventName);
  }

  return NextResponse.json({ received: true });
}
