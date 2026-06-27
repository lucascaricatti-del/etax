/**
 * Migration: Approval Flow + Multiple Models + Model Selection
 *
 * Run the SQL statements below in the Supabase SQL Editor, then execute
 * this script to verify the migration was applied correctly:
 *
 *   node scripts/migration-approval-flow.mjs
 *
 * SQL to run in Supabase Editor:
 * ──────────────────────────────
 *
 * -- 1a. Papel admin/operador dentro da Etax
 * ALTER TABLE profiles
 * ADD COLUMN papel_etax text NOT NULL DEFAULT 'operador'
 * CHECK (papel_etax IN ('admin', 'operador'));
 *
 * -- 1b. Nome e descricao nos modelos (multiplos por tipo)
 * ALTER TABLE modelos ADD COLUMN nome text;
 * ALTER TABLE modelos ADD COLUMN descricao text;
 *
 * -- 1c. Campos de aprovacao nas solicitacoes
 * ALTER TABLE solicitacoes ADD COLUMN modelo_id uuid REFERENCES modelos(id);
 * ALTER TABLE solicitacoes ADD COLUMN aprovado_por uuid REFERENCES profiles(id);
 * ALTER TABLE solicitacoes ADD COLUMN aprovado_em timestamptz;
 * ALTER TABLE solicitacoes ADD COLUMN motivo_reprovacao text;
 *
 * -- 1d. Backfill nomes dos modelos existentes
 * UPDATE modelos m
 * SET nome = tc.nome || ' v' || m.versao
 * FROM tipos_contrato tc
 * WHERE m.tipo_contrato_id = tc.id AND m.nome IS NULL;
 *
 * -- 1e. Marcar admin (substituir pelo email real)
 * UPDATE profiles SET papel_etax = 'admin' WHERE email = 'SEU_EMAIL_ADMIN';
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

  // 1. Check profiles.papel_etax column exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, papel_etax")
    .limit(1)
    .single();
  if (profile && "papel_etax" in profile) {
    console.log("✓ profiles.papel_etax exists");
  } else {
    console.error("✗ profiles.papel_etax NOT found — run migration 1a");
    ok = false;
  }

  // 2. Check modelos.nome and modelos.descricao
  const { data: modelo } = await supabase
    .from("modelos")
    .select("id, nome, descricao")
    .limit(1)
    .single();
  if (modelo && "nome" in modelo && "descricao" in modelo) {
    console.log("✓ modelos.nome and modelos.descricao exist");
  } else {
    console.error("✗ modelos.nome/descricao NOT found — run migration 1b");
    ok = false;
  }

  // 3. Check solicitacoes approval columns
  const { data: sol } = await supabase
    .from("solicitacoes")
    .select("id, modelo_id, aprovado_por, aprovado_em, motivo_reprovacao")
    .limit(1)
    .single();
  const approvalFields = ["modelo_id", "aprovado_por", "aprovado_em", "motivo_reprovacao"];
  if (sol) {
    const missing = approvalFields.filter((f) => !(f in sol));
    if (missing.length === 0) {
      console.log("✓ solicitacoes approval columns exist");
    } else {
      console.error(`✗ solicitacoes missing: ${missing.join(", ")} — run migration 1c`);
      ok = false;
    }
  } else {
    console.log("⚠ No solicitacoes rows to check — verify columns manually");
  }

  // 4. Check at least one admin exists
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("papel_etax", "admin");
  if (admins && admins.length > 0) {
    console.log(`✓ ${admins.length} admin(s) found: ${admins.map((a) => a.email).join(", ")}`);
  } else {
    console.error("✗ No admin found — run migration 1e with the correct email");
    ok = false;
  }

  // 5. Check modelos have names backfilled
  const { data: unnamed } = await supabase
    .from("modelos")
    .select("id")
    .is("nome", null);
  if (!unnamed || unnamed.length === 0) {
    console.log("✓ All modelos have names");
  } else {
    console.error(`✗ ${unnamed.length} modelo(s) without name — run migration 1d`);
    ok = false;
  }

  console.log(ok ? "\n✓ Migration verified successfully" : "\n✗ Migration incomplete — see errors above");
  process.exit(ok ? 0 : 1);
}

verify();
