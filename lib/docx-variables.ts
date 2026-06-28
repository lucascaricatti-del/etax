/**
 * Extrai variáveis {{VARIAVEL}} de um arquivo .docx e infere schema de formulário.
 *
 * Um .docx é um ZIP contendo XML. As variáveis podem estar divididas
 * entre múltiplos <w:t> (runs) no Word — por isso extraímos todo o texto
 * de cada parágrafo antes de procurar os padrões.
 */

import JSZip from "jszip";
import type { CampoSchema } from "@/lib/types";

// ---------------------------------------------------------------------------
// Extração de variáveis
// ---------------------------------------------------------------------------

export async function extractVariablesFromDocx(
  buffer: ArrayBuffer
): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Arquivo .docx inválido: word/document.xml não encontrado");
  }

  const xml = await docFile.async("string");

  // Estratégia: para cada parágrafo (<w:p>), concatenar todos os <w:t> e
  // buscar {{VARIAVEL}}. Isso contorna o split de runs do Word.
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const variables = new Set<string>();

  for (const para of paragraphs) {
    // Extrair texto de todos os <w:t> dentro do parágrafo
    const textParts: string[] = [];
    const tMatches = para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    for (const m of tMatches) {
      textParts.push(m[1]);
    }
    const fullText = textParts.join("");

    // Buscar {{VARIAVEL}} — aceita letras, números e underscore
    const varMatches = fullText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g);
    for (const vm of varMatches) {
      variables.add(vm[1].toUpperCase());
    }
  }

  // Também buscar em headers/footers
  for (const filename of Object.keys(zip.files)) {
    if (
      (filename.startsWith("word/header") ||
        filename.startsWith("word/footer")) &&
      filename.endsWith(".xml")
    ) {
      const hfXml = await zip.files[filename].async("string");
      const hfParas = hfXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
      for (const para of hfParas) {
        const textParts: string[] = [];
        const tMatches = para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
        for (const m of tMatches) {
          textParts.push(m[1]);
        }
        const fullText = textParts.join("");
        const varMatches = fullText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g);
        for (const vm of varMatches) {
          variables.add(vm[1].toUpperCase());
        }
      }
    }
  }

  return Array.from(variables);
}

// ---------------------------------------------------------------------------
// Inferência de tipo a partir do nome da variável
// ---------------------------------------------------------------------------

const KNOWN_LABELS: Record<string, string> = {
  razao_social: "Razão Social",
  nome_fantasia: "Nome Fantasia",
  cnpj: "CNPJ",
  cpf: "CPF",
  cpf_cnpj: "CPF/CNPJ",
  email: "E-mail",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  celular: "Celular",
  endereco: "Endereço",
  cep: "CEP",
  cidade: "Cidade",
  estado: "Estado",
  uf: "UF",
  bairro: "Bairro",
  complemento: "Complemento",
  numero: "Número",
  valor_total: "Valor Total",
  valor: "Valor",
  parcelas: "Parcelas",
  forma_pagamento: "Forma de Pagamento",
  plano: "Plano",
  turma: "Turma",
  vendedor: "Vendedor",
  inicio: "Data de Início",
  duracao: "Duração",
  nome: "Nome",
  nome_completo: "Nome Completo",
  rep_nome: "Nome do Representante",
  rep_cpf: "CPF do Representante",
  rep_email: "E-mail do Representante",
  data_inicio: "Data de Início",
  data_fim: "Data de Término",
  data_nascimento: "Data de Nascimento",
  data_vencimento: "Data de Vencimento",
  rg: "RG",
  nacionalidade: "Nacionalidade",
  profissao: "Profissão",
  estado_civil: "Estado Civil",
  objeto: "Objeto do Contrato",
  mensalidade: "Mensalidade",
};

function inferType(key: string): CampoSchema["type"] {
  if (key.includes("email")) return "email";
  if (
    key.includes("whatsapp") ||
    key.includes("telefone") ||
    key.includes("celular") ||
    key.includes("fone")
  )
    return "tel";
  if (
    key.includes("valor") ||
    key.includes("parcela") ||
    key.includes("preco") ||
    key.includes("mensalidade") ||
    key === "quantidade" ||
    key === "duracao"
  )
    return "number";
  if (
    key.startsWith("data_") ||
    key === "inicio" ||
    key === "vencimento" ||
    key.includes("nascimento") ||
    key === "fim"
  )
    return "date";
  return "text";
}

function generateLabel(key: string): string {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];

  // Auto-gerar: trocar _ por espaço, capitalizar cada palavra
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Gerar schema_campos a partir de variáveis extraídas
// ---------------------------------------------------------------------------

export function inferSchemaFromVariables(
  variables: string[]
): CampoSchema[] {
  return variables.map((v) => {
    const key = v.toLowerCase();
    return {
      key,
      label: generateLabel(key),
      type: inferType(key),
      required: true,
    };
  });
}
