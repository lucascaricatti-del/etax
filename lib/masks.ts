/**
 * Máscaras e normalização canônica.
 *
 * Princípio: a máscara é só apresentação. O banco armazena o dado canônico:
 *   - valor_total: number (reais, ex: 150000.00)
 *   - cnpj: string de 14 dígitos
 *   - cpf: string de 11 dígitos
 *   - cep: string de 8 dígitos
 *   - telefone/whatsapp: string de 10-11 dígitos
 *   - email: string lowercase trimmed
 */

export type MaskType = "brl" | "cnpj" | "cpf" | "cep" | "phone" | "email" | null;

/** Infere o tipo de máscara pelo nome da key ou tipo do campo. */
export function inferMask(key: string, fieldType?: string): MaskType {
  if (key === "valor_total") return "brl";
  if (key === "cnpj") return "cnpj";
  if (key === "cpf") return "cpf";
  if (key === "cep") return "cep";
  if (key === "whatsapp" || key === "telefone") return "phone";
  if (fieldType === "tel") return "phone";
  if (fieldType === "email" || key === "email") return "email";
  return null;
}

// ---------------------------------------------------------------------------
// Mascarar enquanto digita (display para o input)
// ---------------------------------------------------------------------------

export function applyMask(raw: string, mask: MaskType): string {
  if (!mask) return raw;
  switch (mask) {
    case "brl": return maskBRL(raw);
    case "cnpj": return maskCNPJ(raw);
    case "cpf": return maskCPF(raw);
    case "cep": return maskCEP(raw);
    case "phone": return maskPhone(raw);
    case "email": return raw;
    default: return raw;
  }
}

function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const centavos = parseInt(digits, 10);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function maskCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCPF(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCEP(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ---------------------------------------------------------------------------
// Canônico → display (para exibir valores salvos)
// ---------------------------------------------------------------------------

export function formatCanonical(value: unknown, mask: MaskType): string {
  if (value == null || value === "") return "—";
  if (!mask) return String(value);

  switch (mask) {
    case "brl": {
      const reais = canonicalToReais(value);
      if (reais === 0) return "—";
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(reais);
    }
    case "cnpj": {
      const d = String(value).replace(/\D/g, "");
      if (d.length < 14) return String(value);
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
    }
    case "cpf": {
      const d = String(value).replace(/\D/g, "");
      if (d.length < 11) return String(value);
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
    }
    case "cep": {
      const d = String(value).replace(/\D/g, "");
      if (d.length < 8) return String(value);
      return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
    }
    case "phone": {
      const d = String(value).replace(/\D/g, "");
      if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return String(value);
    }
    case "email":
      return String(value);
    default:
      return String(value);
  }
}

/** Formato para ClickSign (display legível, BRL sem prefixo R$). */
export function formatForClickSign(value: unknown, mask: MaskType): string {
  if (value == null || value === "") return "";
  if (!mask) return String(value);

  if (mask === "brl") {
    const reais = canonicalToReais(value);
    if (reais === 0) return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(reais);
  }

  const formatted = formatCanonical(value, mask);
  return formatted === "—" ? "" : formatted;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function validateField(
  value: unknown,
  mask: MaskType,
  required: boolean
): string | null {
  const isEmpty =
    value == null ||
    value === "" ||
    (mask === "brl" && (value === 0 || value === "0"));

  if (required && isEmpty) return "Campo obrigatório";
  if (isEmpty) return null;

  switch (mask) {
    case "cnpj": {
      const d = String(value).replace(/\D/g, "");
      if (d.length !== 14) return "CNPJ deve ter 14 dígitos";
      return null;
    }
    case "cpf": {
      const d = String(value).replace(/\D/g, "");
      if (d.length !== 11) return "CPF deve ter 11 dígitos";
      return null;
    }
    case "cep": {
      const d = String(value).replace(/\D/g, "");
      if (d.length !== 8) return "CEP deve ter 8 dígitos";
      return null;
    }
    case "phone": {
      const d = String(value).replace(/\D/g, "");
      if (d.length < 10 || d.length > 11) return "Telefone inválido";
      return null;
    }
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
        return "E-mail inválido";
      return null;
    }
    case "brl": {
      const reais = canonicalToReais(value);
      if (isNaN(reais) || reais <= 0) return "Valor deve ser maior que zero";
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Normalização em lote (server-side)
// ---------------------------------------------------------------------------

/** Normaliza todos os dados para a forma canônica antes de salvar. */
export function normalizeDados(
  dados: Record<string, unknown>,
  schema: Array<{ key: string; type?: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...dados };
  for (const campo of schema) {
    const mask = inferMask(campo.key, campo.type);
    if (!mask || result[campo.key] == null || result[campo.key] === "") continue;

    const val = result[campo.key];

    if (mask === "brl") {
      if (typeof val === "number") {
        result[campo.key] = val;
      } else {
        const digits = String(val).replace(/\D/g, "");
        result[campo.key] = digits ? parseInt(digits, 10) / 100 : null;
      }
    } else if (mask === "email") {
      result[campo.key] = String(val).trim().toLowerCase();
    } else {
      result[campo.key] = String(val).replace(/\D/g, "");
    }
  }
  return result;
}

/** Formata dados canônicos para o template ClickSign (versão de exibição). */
export function formatDadosForClickSign(
  dados: Record<string, unknown>,
  schema: Array<{ key: string; type?: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...dados };
  for (const campo of schema) {
    const mask = inferMask(campo.key, campo.type);
    if (!mask || result[campo.key] == null || result[campo.key] === "") continue;
    result[campo.key] = formatForClickSign(result[campo.key], mask);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Converte qualquer valor armazenado para reais (number).
 *  - number → usa direto (já é canônico)
 *  - string de dígitos → trata como centavos legado (divide por 100)
 */
function canonicalToReais(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value);
  // Se tem ponto decimal, assume reais (ex: "150000.5")
  if (/^\d+\.\d+$/.test(str)) return parseFloat(str);
  // Senão, trata como centavos legado
  const digits = str.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}
