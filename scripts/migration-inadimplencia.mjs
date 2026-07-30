/**
 * Migração: Inadimplência de contratos
 *
 * Inadimplência é uma dimensão SEPARADA do status de assinatura:
 * o contrato continua assinado/vigente, mas o pagamento está em atraso.
 * É reversível (regularizar) e NÃO desconta da receita — aparece como
 * "receita em risco" nos painéis. Churn definitivo continua sendo o distrato.
 *
 * Rodar MANUALMENTE no Supabase SQL Editor:
 *
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS inadimplente_em date;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_inadimplencia numeric;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS inadimplencia_observacao text;
 *
 * Semântica:
 * - inadimplente_em NULL  = contrato adimplente (normal)
 * - inadimplente_em datado = contrato inadimplente desde essa data
 * - valor_inadimplencia    = valor em aberto (opcional; painéis usam
 *                            COALESCE(valor_inadimplencia, valor))
 * - inadimplencia_observacao = nota livre do admin (opcional)
 *
 * Depois de rodar o SQL, execute este script para verificar:
 *   set -a; source .env.local; set +a; node scripts/migration-inadimplencia.mjs
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
  .select("id, inadimplente_em, valor_inadimplencia, inadimplencia_observacao")
  .limit(1);

if (error) {
  console.error("Migration verification FAILED:", error.message);
  process.exit(1);
}

console.log("Migration OK. Sample row:", JSON.stringify(data?.[0] ?? "(no rows)", null, 2));
console.log("All new columns exist on contratos table.");
