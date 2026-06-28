/**
 * Migração: Dashboard Financeiro + Admin Controls
 *
 * Rodar MANUALMENTE no Supabase SQL Editor:
 *
 * -- 1. Colunas novas em contratos
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS natureza_documento text NOT NULL DEFAULT 'principal' CHECK (natureza_documento IN ('principal', 'aditivo'));
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contrato_pai_id uuid REFERENCES contratos(id);
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS conta_no_dashboard boolean NOT NULL DEFAULT true;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS data_distrato date;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_distrato numeric;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS excluido_em timestamptz;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS excluido_por uuid REFERENCES profiles(id);
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES modelos(id);
 *
 * -- 2. Backfill modelo_id a partir da solicitação
 * UPDATE contratos c
 * SET modelo_id = s.modelo_id
 * FROM solicitacoes s
 * WHERE c.solicitacao_id = s.id
 *   AND c.modelo_id IS NULL
 *   AND s.modelo_id IS NOT NULL;
 *
 * -- 3. Adicionar 'distratado' ao check constraint de status_assinatura
 * -- (verifique se é enum ou check — ajuste conforme seu banco)
 * -- Se for check constraint:
 * ALTER TABLE contratos DROP CONSTRAINT IF EXISTS contratos_status_assinatura_check;
 * ALTER TABLE contratos ADD CONSTRAINT contratos_status_assinatura_check
 *   CHECK (status_assinatura IN ('aguardando_assinatura', 'assinado', 'recusado', 'expirado', 'distratado'));
 *
 * -- Se for enum:
 * -- ALTER TYPE status_assinatura_enum ADD VALUE IF NOT EXISTS 'distratado';
 *
 * Depois de rodar, execute este script para verificar:
 *   node scripts/migration-dashboard-financeiro.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const { data, error } = await sb
  .from("contratos")
  .select("id, natureza_documento, contrato_pai_id, conta_no_dashboard, data_distrato, valor_distrato, excluido_em, excluido_por, modelo_id")
  .limit(1);

if (error) {
  console.error("Migration verification FAILED:", error.message);
  process.exit(1);
}

console.log("Migration OK. Sample row:", JSON.stringify(data?.[0] ?? "(no rows)", null, 2));
console.log("All new columns exist on contratos table.");
