import { NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";

// Extração pode demorar em PDFs longos
export const maxDuration = 60;

/** Campos que a IA extrai do PDF do contrato antigo. */
export interface CamposExtraidos {
  nome: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  valor_total: number | null;
  data_assinatura: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
}

const EXTRACTION_PROMPT = `Você está lendo o PDF de um contrato brasileiro já assinado (prestação de serviços de mentoria/educação).
A CONTRATANTE é o cliente (pessoa física ou jurídica) que contratou o serviço. A CONTRATADA é a empresa prestadora — NÃO extraia os dados da contratada.

Extraia os dados da CONTRATANTE e do contrato, e responda APENAS com um JSON válido (sem markdown, sem explicações), exatamente neste formato:
{
  "nome": "nome completo da contratante (PF) ou razão social (PJ)",
  "cpf_cnpj": "CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) da contratante",
  "email": "e-mail da contratante",
  "telefone": "telefone/whatsapp da contratante",
  "valor_total": 15000.00,
  "data_assinatura": "YYYY-MM-DD",
  "vigencia_inicio": "YYYY-MM-DD",
  "vigencia_fim": "YYYY-MM-DD"
}

Regras:
- "valor_total" é o valor total do contrato em reais, como número (sem "R$", sem aspas).
- "data_assinatura": data em que o contrato foi assinado/celebrado. Se houver assinatura eletrônica com data, use-a; senão use a data do documento.
- "vigencia_inicio"/"vigencia_fim": período de vigência do contrato, se declarado.
- Qualquer campo que não existir no documento: use null. NÃO invente valores.`;

/**
 * POST /api/contratos/importar/extrair — lê um PDF de contrato antigo com IA
 * (Anthropic) e retorna os campos estruturados para revisão. Admin Etax.
 * FormData: file (application/pdf, máx 4MB).
 */
export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY não configurada. Adicione a variável de ambiente na Vercel para usar a leitura por IA (ou preencha os campos manualmente).",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo PDF é obrigatório" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "O arquivo precisa ser um PDF" },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF muito grande (máximo 4MB)" },
        { status: 400 }
      );
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[Importar/Extrair] Erro na API Anthropic:", res.status, errBody);
      return NextResponse.json(
        {
          error:
            res.status === 401
              ? "Chave da API Anthropic inválida. Verifique a ANTHROPIC_API_KEY."
              : "Falha ao ler o PDF com IA. Tente novamente ou preencha manualmente.",
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string =
      data?.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

    const campos = parseCampos(text);
    if (!campos) {
      console.error("[Importar/Extrair] Resposta da IA não é JSON válido:", text);
      return NextResponse.json(
        { error: "A IA não conseguiu estruturar os dados deste PDF. Preencha manualmente." },
        { status: 422 }
      );
    }

    return NextResponse.json({ campos });
  } catch (err) {
    console.error("[Importar/Extrair] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Parse tolerante: aceita JSON puro ou envolto em cercas de código/texto. */
function parseCampos(text: string): CamposExtraidos | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const candidates = [cleaned];

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return {
          nome: strOrNull(parsed.nome),
          cpf_cnpj: strOrNull(parsed.cpf_cnpj),
          email: strOrNull(parsed.email),
          telefone: strOrNull(parsed.telefone),
          valor_total: numOrNull(parsed.valor_total),
          data_assinatura: dateOrNull(parsed.data_assinatura),
          vigencia_inicio: dateOrNull(parsed.vigencia_inicio),
          vigencia_fim: dateOrNull(parsed.vigencia_fim),
        };
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function dateOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
