/**
 * Migration: PDF assinado no Storage
 *
 * Run the SQL below in the Supabase SQL Editor, then run this script to verify:
 *
 *   node scripts/migration-pdf-storage.mjs
 *
 * SQL to run in Supabase Editor:
 * ──────────────────────────────
 *
 * -- 1. Colunas para path e checksum do PDF assinado
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS pdf_assinado_path text;
 * ALTER TABLE contratos ADD COLUMN IF NOT EXISTS signed_checksum text;
 *
 * -- 2. Criar bucket privado para PDFs assinados
 * INSERT INTO storage.buckets (id, name, public)
 * VALUES ('contratos-assinados', 'contratos-assinados', false)
 * ON CONFLICT (id) DO NOTHING;
 *
 * -- 3. Policy: service_role (admin) pode tudo no bucket
 * --    (o admin client já bypassa RLS, mas policies de storage são separadas)
 * CREATE POLICY "service_role full access" ON storage.objects
 *   FOR ALL
 *   TO service_role
 *   USING (bucket_id = 'contratos-assinados')
 *   WITH CHECK (bucket_id = 'contratos-assinados');
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

  // 1. Check columns exist
  const { data: contrato } = await supabase
    .from("contratos")
    .select("id, pdf_assinado_path, signed_checksum")
    .limit(1)
    .maybeSingle();

  // Even if no rows, the query succeeding means columns exist
  if (contrato === null || contrato === undefined) {
    // Query succeeded (no rows or one row) — check if it errored
    const { error } = await supabase
      .from("contratos")
      .select("pdf_assinado_path, signed_checksum")
      .limit(1);
    if (error) {
      console.error("✗ contratos columns missing:", error.message);
      ok = false;
    } else {
      console.log("✓ contratos.pdf_assinado_path and signed_checksum exist");
    }
  } else {
    console.log("✓ contratos.pdf_assinado_path and signed_checksum exist");
  }

  // 2. Check bucket exists
  const { data: buckets, error: errBuckets } = await supabase
    .storage
    .listBuckets();

  if (errBuckets) {
    console.error("✗ Could not list buckets:", errBuckets.message);
    ok = false;
  } else {
    const found = buckets?.some((b) => b.id === "contratos-assinados");
    if (found) {
      console.log("✓ Bucket 'contratos-assinados' exists");
    } else {
      console.error("✗ Bucket 'contratos-assinados' NOT found");
      ok = false;
    }
  }

  console.log(ok ? "\n✓ Migration verified successfully" : "\n✗ Migration incomplete — see errors above");
  process.exit(ok ? 0 : 1);
}

verify();
