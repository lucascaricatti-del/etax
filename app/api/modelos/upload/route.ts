import { NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { createTemplate, slugifyFilename } from "@/lib/clicksign";
import {
  extractVariablesFromDocx,
  inferSchemaFromVariables,
} from "@/lib/docx-variables";

/**
 * POST /api/modelos/upload
 *
 * Recebe FormData com:
 *   - file: arquivo .docx
 *   - nome: nome do modelo (usado como filename no ClickSign)
 *
 * Retorna:
 *   - clicksign_template_key: ID do template criado na ClickSign
 *   - variaveis: string[] (nomes em MAIÚSCULO)
 *   - schema_campos: CampoSchema[] (schema inferido com labels e tipos)
 */
export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Acesso restrito à Etax" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const nome = (formData.get("nome") as string)?.trim();

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo .docx é obrigatório" },
        { status: 400 }
      );
    }

    if (!nome) {
      return NextResponse.json(
        { error: "Nome do modelo é obrigatório" },
        { status: 400 }
      );
    }

    // Validar extensão
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { error: "Apenas arquivos .docx são aceitos" },
        { status: 400 }
      );
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande (máximo 10MB)" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // 1. Extrair variáveis do .docx
    let variaveis: string[];
    try {
      variaveis = await extractVariablesFromDocx(buffer);
    } catch (err) {
      console.error("[Upload Modelo] Erro ao extrair variáveis:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Erro ao processar arquivo .docx",
        },
        { status: 400 }
      );
    }

    if (variaveis.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma variável {{VARIAVEL}} encontrada no documento. Verifique se o .docx contém placeholders no formato {{NOME_DA_VARIAVEL}}.",
        },
        { status: 400 }
      );
    }

    // 2. Criar template na ClickSign
    const filename = slugifyFilename(nome);
    const base64 = Buffer.from(buffer).toString("base64");

    let clicksignTemplateKey: string;
    try {
      clicksignTemplateKey = await createTemplate(filename, base64);
    } catch (err) {
      console.error("[Upload Modelo] Erro ao criar template na ClickSign:", err);
      return NextResponse.json(
        {
          error:
            "Erro ao criar template na ClickSign: " +
            (err instanceof Error ? err.message : "erro desconhecido"),
        },
        { status: 502 }
      );
    }

    // 3. Inferir schema dos campos
    const schemaCampos = inferSchemaFromVariables(variaveis);

    console.log("[Upload Modelo] Sucesso:", {
      nome,
      filename,
      clicksignTemplateKey,
      variaveis,
      schemaCamposCount: schemaCampos.length,
    });

    return NextResponse.json({
      clicksign_template_key: clicksignTemplateKey,
      variaveis,
      schema_campos: schemaCampos,
    });
  } catch (err) {
    console.error("[Upload Modelo] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
