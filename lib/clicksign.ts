/**
 * ClickSign API v3 client.
 *
 * JSON:API format — Content-Type: application/vnd.api+json
 * Base URL from env CLICKSIGN_BASE (production: https://app.clicksign.com/api/v3)
 * Auth from env CLICKSIGN_TOKEN
 *
 * Normalização de variáveis:
 * No banco e no formulário, as keys são minúsculas (ex: razao_social, cnpj).
 * A ClickSign espera variáveis em MAIÚSCULAS (ex: RAZAO_SOCIAL, CNPJ).
 * A função `toTemplateData` converte automaticamente.
 */

const BASE = () => process.env.CLICKSIGN_BASE!;
const TOKEN = () => process.env.CLICKSIGN_TOKEN!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  body?: unknown
): Promise<T> {
  const url = `${BASE()}${path}`;

  console.log(`[ClickSign] ${method} ${url}`);
  if (body) console.log("[ClickSign] request body:", JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: TOKEN(),
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
// API calls
// ---------------------------------------------------------------------------

/** 1. Criar envelope */
export async function createEnvelope(name: string): Promise<string> {
  const res = await clicksignFetch<EnvelopeResponse>("/envelopes", "POST", {
    data: {
      type: "envelopes",
      attributes: { name },
    },
  });
  return res.data.id;
}

/** 2. Adicionar documento via template */
export async function addTemplateDocument(
  envelopeId: string,
  filename: string,
  templateKey: string,
  templateData: Record<string, string>
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
    }
  );
  return res.data.id;
}

/** 3. Adicionar signatário */
export async function addSigner(
  envelopeId: string,
  name: string,
  email: string
): Promise<string> {
  const res = await clicksignFetch<SignerResponse>(
    `/envelopes/${envelopeId}/signers`,
    "POST",
    {
      data: {
        type: "signers",
        attributes: { name, email },
      },
    }
  );
  return res.data.id;
}

/** 4. Adicionar requirement (autenticação ou assinatura) */
export async function addRequirement(
  envelopeId: string,
  documentId: string,
  signerId: string,
  action: "provide_evidence" | "agree",
  extra: { auth?: string; role?: string }
): Promise<void> {
  const attributes: Record<string, string> = { action };
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
  });
}

/** 5. Ativar envelope (status → running) */
export async function activateEnvelope(envelopeId: string): Promise<void> {
  await clicksignFetch(`/envelopes/${envelopeId}`, "PATCH", {
    data: {
      id: envelopeId,
      type: "envelopes",
      attributes: { status: "running" },
    },
  });
}
