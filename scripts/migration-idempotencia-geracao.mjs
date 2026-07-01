/**
 * Migração: Idempotência da geração de contrato (C2/C3)
 *
 * Rodar MANUALMENTE no Supabase SQL Editor ANTES de fazer deploy do código:
 *
 * -- 0. Pré-check: verificar se já existem contratos duplicados por solicitação.
 * --    Se retornar linhas, resolva manualmente (soft delete do duplicado) antes do passo 1.
 * SELECT solicitacao_id, count(*)
 * FROM contratos
 * WHERE solicitacao_id IS NOT NULL
 * GROUP BY solicitacao_id
 * HAVING count(*) > 1;
 *
 * -- 1. UNIQUE em solicitacao_id (permite múltiplos NULLs — contratos sem solicitação seguem ok)
 * ALTER TABLE contratos
 *   ADD CONSTRAINT contratos_solicitacao_id_unique UNIQUE (solicitacao_id);
 *
 * -- 2. Adicionar 'rascunho' ao check de status_assinatura
 * ALTER TABLE contratos DROP CONSTRAINT IF EXISTS contratos_status_assinatura_check;
 * ALTER TABLE contratos ADD CONSTRAINT contratos_status_assinatura_check
 *   CHECK (status_assinatura IN ('rascunho', 'aguardando_assinatura', 'assinado', 'recusado', 'expirado', 'distratado'));
 *
 * -- 3. Adicionar 'gerando' ao check de status de solicitacoes (se houver check constraint)
 * ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
 * ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_status_check
 *   CHECK (status IN ('nova', 'em_confeccao', 'aguardando_aprovacao', 'aprovada', 'gerando', 'enviada_assinatura', 'cancelada'));
 *
 * Depois de rodar, execute este script para verificar:
 *   node scripts/migration-idempotencia-geracao.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

let failed = false;

// 1. Verificar duplicados de solicitacao_id (a UNIQUE só existe se isso estiver limpo)
const { data: contratos, error: errContratos } = await sb
  .from("contratos")
  .select("id, solicitacao_id")
  .not("solicitacao_id", "is", null);

if (errContratos) {
  console.error("FAILED lendo contratos:", errContratos.message);
  process.exit(1);
}

const counts = new Map();
for (const c of contratos ?? []) {
  counts.set(c.solicitacao_id, (counts.get(c.solicitacao_id) ?? 0) + 1);
}
const dups = [...counts.entries()].filter(([, n]) => n > 1);
if (dups.length > 0) {
  failed = true;
  console.error(
    "ATENÇÃO: contratos duplicados por solicitacao_id (a constraint UNIQUE não pode ter sido aplicada):"
  );
  for (const [sid, n] of dups) console.error(`  solicitacao_id=${sid} → ${n} contratos`);
} else {
  console.log("OK: nenhum contrato duplicado por solicitacao_id.");
}

// 2. Testar a UNIQUE constraint: tentar inserir contrato com solicitacao_id já usado
const existing = (contratos ?? []).find((c) => c.solicitacao_id);
if (existing) {
  const { error: errDup } = await sb.from("contratos").insert({
    solicitacao_id: existing.solicitacao_id,
    tipo: "teste-migracao",
    status_assinatura: "rascunho",
  });
  if (errDup?.code === "23505") {
    console.log("OK: UNIQUE(solicitacao_id) ativa (insert duplicado rejeitado com 23505).");
  } else if (errDup) {
    console.log(
      `AVISO: insert de teste falhou com outro erro (${errDup.code}): ${errDup.message}`
    );
    console.log("Verifique manualmente se a constraint UNIQUE e o status 'rascunho' foram aplicados.");
  } else {
    failed = true;
    console.error(
      "FAILED: insert duplicado foi aceito — a constraint UNIQUE NÃO está ativa. Removendo registro de teste..."
    );
    await sb
      .from("contratos")
      .delete()
      .eq("tipo", "teste-migracao")
      .eq("status_assinatura", "rascunho");
  }
} else {
  console.log(
    "AVISO: não há contratos com solicitacao_id para testar a UNIQUE. Verifique manualmente no SQL Editor:"
  );
  console.log(
    "  SELECT conname FROM pg_constraint WHERE conname = 'contratos_solicitacao_id_unique';"
  );
}

if (failed) {
  console.error("\nMigração INCOMPLETA. Rode o SQL do cabeçalho no Supabase SQL Editor.");
  process.exit(1);
}
console.log("\nMigração verificada com sucesso.");
