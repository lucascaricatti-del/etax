/**
 * Migration: Modelos — natureza_financeira + disponibilidade por empresa
 *
 * Run the SQL below in the Supabase SQL Editor, then run this script to verify:
 *
 *   node scripts/migration-modelos-disponibilidade.mjs
 *
 * SQL to run in Supabase Editor:
 * ──────────────────────────────
 *
 * -- 1. Natureza financeira
 * ALTER TABLE modelos ADD COLUMN IF NOT EXISTS natureza_financeira text
 *   NOT NULL DEFAULT 'neutro'
 *   CHECK (natureza_financeira IN ('receita', 'despesa', 'neutro'));
 *
 * -- 2. Disponibilidade (todas empresas vs lista específica)
 * ALTER TABLE modelos ADD COLUMN IF NOT EXISTS disponibilidade text
 *   NOT NULL DEFAULT 'todas'
 *   CHECK (disponibilidade IN ('todas', 'especificas'));
 *
 * -- 3. Tabela de vínculo modelo <-> empresa (N:N)
 * CREATE TABLE IF NOT EXISTS modelo_empresas (
 *   modelo_id uuid NOT NULL REFERENCES modelos(id) ON DELETE CASCADE,
 *   workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 *   PRIMARY KEY (modelo_id, workspace_id)
 * );
 *
 * -- 4. Configurar modelo Club existente
 * UPDATE modelos
 * SET natureza_financeira = 'receita',
 *     disponibilidade = 'especificas'
 * WHERE clicksign_template_key = 'e9ea4014-a29d-49eb-92b3-aed8c4fc6424';
 *
 * -- 5. Vincular modelo Club à Brand Legacy
 * INSERT INTO modelo_empresas (modelo_id, workspace_id)
 * SELECT m.id, '26ba368f-6bfc-44ef-b07a-5733be4faa57'
 * FROM modelos m
 * WHERE m.clicksign_template_key = 'e9ea4014-a29d-49eb-92b3-aed8c4fc6424'
 * ON CONFLICT DO NOTHING;
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  let ok = true;

  // 1. Check natureza_financeira + disponibilidade columns
  const { data: modelo, error: errModelo } = await supabase
    .from("modelos")
    .select("id, natureza_financeira, disponibilidade")
    .limit(1)
    .single();

  if (errModelo) {
    console.error("✗ modelos columns missing:", errModelo.message);
    ok = false;
  } else {
    console.log("✓ modelos.natureza_financeira and disponibilidade exist");
  }

  // 2. Check modelo_empresas table
  const { error: errME } = await supabase
    .from("modelo_empresas")
    .select("modelo_id, workspace_id")
    .limit(1);

  if (errME) {
    console.error("✗ modelo_empresas table missing:", errME.message);
    ok = false;
  } else {
    console.log("✓ modelo_empresas table exists");
  }

  // 3. Check Club modelo config
  const { data: club } = await supabase
    .from("modelos")
    .select("id, natureza_financeira, disponibilidade")
    .eq("clicksign_template_key", "e9ea4014-a29d-49eb-92b3-aed8c4fc6424")
    .single();

  if (club?.natureza_financeira === "receita" && club?.disponibilidade === "especificas") {
    console.log("✓ Club modelo: natureza=receita, disponibilidade=especificas");
  } else {
    console.error("✗ Club modelo not configured:", club);
    ok = false;
  }

  // 4. Check vínculo com Brand Legacy
  if (club) {
    const { data: vinculo } = await supabase
      .from("modelo_empresas")
      .select("workspace_id")
      .eq("modelo_id", club.id)
      .eq("workspace_id", "26ba368f-6bfc-44ef-b07a-5733be4faa57")
      .maybeSingle();

    if (vinculo) {
      console.log("✓ Club vinculado à Brand Legacy");
    } else {
      console.error("✗ Club NOT vinculado à Brand Legacy");
      ok = false;
    }
  }

  console.log(ok ? "\n✓ Migration verified successfully" : "\n✗ Migration incomplete — see errors above");
  process.exit(ok ? 0 : 1);
}

verify();
