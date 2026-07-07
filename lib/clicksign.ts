/**
 * ClickSign API v3 client.
 *
 * JSON:API format — Content-Type: application/vnd.api+json
 * Base URL from env CLICKSIGN_BASE (production: https://app.clicksign.com/api/v3)
 * Token: per-workspace (workspace_clicksign_config.clicksign_token) ou fallback env CLICKSIGN_TOKEN
 *
 * Normalização de variáveis:
 * No banco e no formulário, as keys são minúsculas (ex: razao_social, cnpj).
 * A ClickSign espera variáveis em MAIÚSCULAS (ex: RAZAO_SOCIAL, CNPJ).
 * A função `toTemplateData` converte automaticamente.
 */

const BASE = () => process.env.CLICKSIGN_BASE!;
const FALLBACK_TOKEN = () => process.env.CLICKSIGN_TOKEN!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gera filename seguro para a ClickSign: sem acentos, sem caracteres especiais,
 * apenas letras/números/hífens, com extensão .docx.
 *
 * Exemplo: "Club — VITALITÀ COMÉRCIO" → "club-vitalita-comercio.docx"
 */
export function slugifyFilename(raw: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tudo que não é alfanumérico vira hífen
    .replace(/^-+|-+$/g, "") // trim hífens nas pontas
    .replace(/-{2,}/g, "-"); // colapsa hífens consecutivos
  return `${slug || "documento"}.docx`;
}

/**
 * Formata CPF para o padrão aceito pela ClickSign no campo `documentation`:
 * "000.000.000-00". Aceita entrada só com dígitos (canônico do banco) ou já
 * pontuada (config legada). Se não tiver 11 dígitos, devolve como veio —
 * a validação pré-geração deve ter bloqueado antes.
 */
export function formatCpfClickSign(raw: string): string {
  const d = String(raw).replace(/\D/g, "");
  if (d.length !== 11) return String(raw);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara parcial de CPF para log: mostra só os 2 últimos dígitos. */
function maskCpfForLog(value: string): string {
  const d = String(value).replace(/\D/g, "");
  return `***.***.***-${d.slice(-2) || "??"}`;
}

export function toTemplateData(
  dados: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(dados)) {
    result[key.toUpperCase()] = String(value ?? "");
  }
  return result;
}

async function clicksignFetch<T = unknown>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
  token?: string
): Promise<T> {
  const url = `${BASE()}${path}`;
  const authToken = token || FALLBACK_TOKEN();

  console.log(`[ClickSign] ${method} ${url}`);
  if (body) {
    // Mascara CPFs (documentation) no log por segurança
    const bodyLog = JSON.stringify(body, null, 2).replace(
      /("documentation":\s*")([^"]+)(")/g,
      (_m, p1: string, v: string, p3: string) =>
        `${p1}***.***.***-${v.replace(/\D/g, "").slice(-2)}${p3}`
    );
    console.log("[ClickSign] request body:", bodyLog);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authToken,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  console.log(`[ClickSign] response ${res.status}:`, text);

  if (!res.ok) {
    throw new Error(
      `ClickSign ${method} ${path} failed (${res.status}): ${text}`
    );
  }

  return text ? JSON.parse(text) : ({} as T);
}

// ---------------------------------------------------------------------------
// JSON:API response types
// ---------------------------------------------------------------------------

interface EnvelopeResponse {
  data: { id: string; type: "envelopes"; attributes: { status: string } };
}

interface DocumentResponse {
  data: { id: string; type: "documents" };
}

interface SignerResponse {
  data: { id: string; type: "signers" };
}

// ---------------------------------------------------------------------------
// API calls — todas aceitam token opcional (per-workspace)
// ---------------------------------------------------------------------------

/** 1. Criar envelope */
export async function createEnvelope(name: string, token?: string): Promise<string> {
  const res = await clicksignFetch<EnvelopeResponse>("/envelopes", "POST", {
    data: {
      type: "envelopes",
      attributes: { name },
    },
  }, token);
  return res.data.id;
}

/** 2. Adicionar documento via template */
export async function addTemplateDocument(
  envelopeId: string,
  filename: string,
  templateKey: string,
  templateData: Record<string, string>,
  token?: string
): Promise<string> {
  const res = await clicksignFetch<DocumentResponse>(
    `/envelopes/${envelopeId}/documents`,
    "POST",
    {
      data: {
        type: "documents",
        attributes: {
          filename,
          template: {
            key: templateKey,
            data: templateData,
          },
        },
      },
    },
    token
  );
  return res.data.id;
}

/** 3. Adicionar signatário */
export async function addSigner(
  envelopeId: string,
  name: string,
  email: string,
  token?: string,
  documentation?: string
): Promise<string> {
  const attributes: Record<string, unknown> = { name, email };
  if (documentation) {
    const recebidoDigits = String(documentation).replace(/\D/g, "");
    const recebidoPontuado = /\D/.test(String(documentation).trim());
    const formatted = formatCpfClickSign(documentation);
    attributes.documentation = formatted;
    attributes.has_documentation = true;
    console.log(
      `[ClickSign] Signer "${name}": documentation recebida com ${recebidoDigits.length} dígitos ` +
        `(${recebidoPontuado ? "com pontuação" : "só dígitos"}) → enviada como ${maskCpfForLog(formatted)} ` +
        `(padrão 000.000.000-00)`
    );
  }

  const res = await clicksignFetch<SignerResponse>(
    `/envelopes/${envelopeId}/signers`,
    "POST",
    {
      data: {
        type: "signers",
        attributes,
      },
    },
    token
  );
  return res.data.id;
}

/** 4. Adicionar requirement (autenticação ou assinatura) */
export async function addRequirement(
  envelopeId: string,
  documentId: string,
  signerId: string,
  action: "provide_evidence" | "agree",
  extra: { auth?: string; role?: string },
  token?: string
): Promise<void> {
  const attributes: Record<string, string | boolean> = { action };
  if (extra.auth) attributes.auth = extra.auth;
  if (extra.role) attributes.role = extra.role;

  await clicksignFetch(`/envelopes/${envelopeId}/requirements`, "POST", {
    data: {
      type: "requirements",
      attributes,
      relationships: {
        document: { data: { type: "documents", id: documentId } },
        signer: { data: { type: "signers", id: signerId } },
      },
    },
  }, token);
}

// ---------------------------------------------------------------------------
// Templates API
// ---------------------------------------------------------------------------

interface TemplateResponse {
  data: { id: string; type: "templates"; attributes: { name: string } };
}

/** Criar template a partir de .docx (base64) */
export async function createTemplate(
  name: string,
  contentBase64: string,
  token?: string
): Promise<string> {
  const res = await clicksignFetch<TemplateResponse>("/templates", "POST", {
    data: {
      type: "templates",
      attributes: {
        name,
        content_base64: contentBase64,
      },
    },
  }, token);
  return res.data.id;
}

/** 5. Ativar envelope (status → running) */
export async function activateEnvelope(envelopeId: string, token?: string): Promise<void> {
  await clicksignFetch(`/envelopes/${envelopeId}`, "PATCH", {
    data: {
      id: envelopeId,
      type: "envelopes",
      attributes: { status: "running" },
    },
  }, token);
}
