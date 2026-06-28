/**
 * Migração: Configuração de assinatura por empresa (workspace)
 *
 * Rodar MANUALMENTE no Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS workspace_clicksign_config (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   workspace_id uuid NOT NULL REFERENCES workspaces(id) UNIQUE,
 *   clicksign_token text NOT NULL,
 *   contratada_nome text NOT NULL,
 *   contratada_email text NOT NULL,
 *   contratada_auto boolean NOT NULL DEFAULT false,
 *   testemunha1_nome text NOT NULL,
 *   testemunha1_email text NOT NULL,
 *   testemunha2_nome text NOT NULL,
 *   testemunha2_email text NOT NULL,
 *   criado_em timestamptz DEFAULT now(),
 *   atualizado_em timestamptz DEFAULT now()
 * );
 *
 * Depois de rodar, execute este script para verificar:
 *   node scripts/migration-workspace-clicksign-config.mjs
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
  .from("workspace_clicksign_config")
  .select("id, workspace_id, clicksign_token, contratada_nome, contratada_email, contratada_auto, testemunha1_nome, testemunha1_email, testemunha2_nome, testemunha2_email")
  .limit(1);

if (error) {
  console.error("Migration verification FAILED:", error.message);
  process.exit(1);
}

console.log("Migration OK. Sample row:", JSON.stringify(data?.[0] ?? "(no rows)", null, 2));
console.log("Table workspace_clicksign_config exists with all columns.");
