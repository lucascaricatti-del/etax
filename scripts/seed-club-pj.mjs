import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Club PJ — 13 campos alinhados ao contrato real e variáveis ClickSign.
// Keys em minúsculas; ao montar template.data para a ClickSign, converter para MAIÚSCULAS.
const schemaClubPJ = [
  { key: "razao_social", label: "Razão social", type: "text", required: true, placeholder: "Razão social da empresa" },
  { key: "cnpj", label: "CNPJ", type: "text", required: true, placeholder: "00.000.000/0000-00" },
  { key: "endereco", label: "Endereço da sede", type: "text", required: true, placeholder: "Rua, nº, bairro, cidade - UF" },
  { key: "cep", label: "CEP", type: "text", required: true, placeholder: "00000-000" },
  { key: "rep_nome", label: "Nome do representante legal", type: "text", required: true, placeholder: "Nome completo" },
  { key: "cpf", label: "CPF do representante", type: "text", required: true, placeholder: "000.000.000-00" },
  { key: "rg", label: "RG com órgão emissor", type: "text", required: true, placeholder: "00.000.000-0 SSP/UF" },
  { key: "endereco_rep_legal", label: "Endereço residencial do representante", type: "text", required: true, placeholder: "Rua, nº, bairro, cidade - UF" },
  { key: "email", label: "E-mail do representante", type: "email", required: true, placeholder: "email@empresa.com" },
  { key: "valor_total", label: "Valor total", type: "text", required: true, placeholder: "R$ 0,00" },
  { key: "valor_extenso", label: "Valor por extenso", type: "text", required: true, placeholder: "mil reais" },
  { key: "forma_pgto", label: "Forma de pagamento", type: "select", required: true, options: ["Pix", "Boleto", "Cartão de crédito", "Transferência bancária"] },
  { key: "vencimento", label: "Vencimento", type: "date", required: true },
];

// Variáveis do modelo ClickSign — lista das keys que serão enviadas como template.data
// Na ClickSign as variáveis são em MAIÚSCULAS; a normalização é feita no código ao montar o envelope.
const variaveis = schemaClubPJ.map((c) => c.key);

async function seed() {
  // 1. Atualizar schema_campos do Club
  const { error: errClub } = await supabase
    .from("tipos_contrato")
    .update({ schema_campos: schemaClubPJ })
    .eq("slug", "club");

  if (errClub) {
    console.error("Erro ao atualizar Club:", errClub);
    process.exit(1);
  }
  console.log("✓ Club schema_campos atualizado (13 campos PJ).");

  // 2. Buscar o ID do tipo club
  const { data: tipoClub } = await supabase
    .from("tipos_contrato")
    .select("id")
    .eq("slug", "club")
    .single();

  if (!tipoClub) {
    console.error("Tipo 'club' não encontrado.");
    process.exit(1);
  }

  // 3. Desativar modelos antigos do club (se existirem)
  await supabase
    .from("modelos")
    .update({ ativo: false })
    .eq("tipo_contrato_id", tipoClub.id);

  // 4. Inserir o novo modelo com template_key da ClickSign
  const { error: errModelo } = await supabase.from("modelos").insert({
    tipo_contrato_id: tipoClub.id,
    clicksign_template_key: "e9ea4014-a29d-49eb-92b3-aed8c4fc6424",
    variaveis,
    workspace_id: null, // padrão Etax (vale para todos)
    versao: 1,
    ativo: true,
  });

  if (errModelo) {
    console.error("Erro ao inserir modelo Club:", errModelo);
    process.exit(1);
  }
  console.log("✓ Modelo Club inserido (template_key: e9ea4014...).");

  // 5. Verificar
  const { data: modelo } = await supabase
    .from("modelos")
    .select("id, clicksign_template_key, variaveis, ativo")
    .eq("tipo_contrato_id", tipoClub.id)
    .eq("ativo", true)
    .single();

  console.log("\nVerificação:");
  console.log("  Modelo ID:", modelo?.id);
  console.log("  Template key:", modelo?.clicksign_template_key);
  console.log("  Variáveis:", modelo?.variaveis?.length, "campos");
  console.log("  Ativo:", modelo?.ativo);

  const { data: tipo } = await supabase
    .from("tipos_contrato")
    .select("schema_campos")
    .eq("slug", "club")
    .single();

  console.log("  Schema campos:", tipo?.schema_campos?.length, "campos");
  console.log("\nSeed concluído!");
}

seed();
