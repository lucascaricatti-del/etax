import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const schemaClub = [
  { key: "nome", label: "Nome completo", type: "text", required: true, placeholder: "Nome do mentorado" },
  { key: "cpf", label: "CPF", type: "text", required: true, placeholder: "000.000.000-00" },
  { key: "email", label: "E-mail", type: "email", required: true, placeholder: "email@exemplo.com" },
  { key: "whatsapp", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
  { key: "plano", label: "Plano", type: "select", required: true, options: ["Mensal", "Trimestral", "Semestral", "Anual"] },
  { key: "valor", label: "Valor (R$)", type: "number", required: true, placeholder: "0,00" },
  { key: "forma_pagamento", label: "Forma de pagamento", type: "select", required: true, options: ["Pix", "Boleto", "Cartão de crédito"] },
  { key: "inicio", label: "Data de início", type: "date", required: true },
  { key: "duracao", label: "Duração (meses)", type: "number", required: true, placeholder: "12" },
  { key: "vendedor", label: "Vendedor", type: "text", required: true, placeholder: "Nome do vendedor" },
];

const schemaTracao = [
  { key: "nome", label: "Nome completo", type: "text", required: true, placeholder: "Nome do mentorado" },
  { key: "cpf", label: "CPF", type: "text", required: true, placeholder: "000.000.000-00" },
  { key: "email", label: "E-mail", type: "email", required: true, placeholder: "email@exemplo.com" },
  { key: "whatsapp", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
  { key: "turma", label: "Turma", type: "text", required: true, placeholder: "Ex: Turma 10" },
  { key: "valor_total", label: "Valor total (R$)", type: "number", required: true, placeholder: "0,00" },
  { key: "parcelas", label: "Número de parcelas", type: "number", required: true, placeholder: "12" },
  { key: "forma_pagamento", label: "Forma de pagamento", type: "select", required: true, options: ["Pix", "Boleto", "Cartão de crédito"] },
  { key: "inicio", label: "Data de início", type: "date", required: true },
  { key: "vendedor", label: "Vendedor", type: "text", required: true, placeholder: "Nome do vendedor" },
];

async function seed() {
  // 1. Update schema_campos for Club
  const { error: errClub } = await supabase
    .from("tipos_contrato")
    .update({ schema_campos: schemaClub })
    .eq("slug", "club");

  if (errClub) {
    console.error("Erro ao atualizar Club:", errClub);
    process.exit(1);
  }
  console.log("Club schema_campos atualizado.");

  // 2. Update schema_campos for Tracao
  const { error: errTracao } = await supabase
    .from("tipos_contrato")
    .update({ schema_campos: schemaTracao })
    .eq("slug", "tracao");

  if (errTracao) {
    console.error("Erro ao atualizar Tracao:", errTracao);
    process.exit(1);
  }
  console.log("Tracao schema_campos atualizado.");

  // 3. Add UNIQUE constraint on contrapartes.cpf_cnpj
  const { error: errUnique } = await supabase.rpc("exec_sql", {
    sql: `ALTER TABLE contrapartes ADD CONSTRAINT contrapartes_cpf_cnpj_unique UNIQUE (cpf_cnpj);`,
  });

  if (errUnique) {
    // Constraint may already exist
    if (errUnique.message?.includes("already exists")) {
      console.log("UNIQUE constraint em cpf_cnpj ja existe.");
    } else {
      console.error("Erro ao adicionar UNIQUE constraint:", errUnique);
      console.log("Tentando via query direta...");
    }
  } else {
    console.log("UNIQUE constraint em contrapartes.cpf_cnpj adicionada.");
  }

  // Verify
  const { data: tipos } = await supabase
    .from("tipos_contrato")
    .select("slug, schema_campos")
    .in("slug", ["club", "tracao"]);

  console.log("\nVerificacao:");
  for (const t of tipos || []) {
    console.log(`  ${t.slug}: ${t.schema_campos?.length || 0} campos`);
  }

  console.log("\nSeed concluido!");
}

seed();
