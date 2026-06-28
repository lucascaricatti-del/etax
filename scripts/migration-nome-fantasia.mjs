#!/usr/bin/env node
/**
 * Migration: nome_fantasia em workspaces
 *
 * SQL para rodar no Supabase SQL Editor:
 *
 *   ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS nome_fantasia text;
 *
 * Depois rode:
 *   set -a && source .env.local && set +a && node scripts/migration-nome-fantasia.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

async function verify() {
  console.log("\n=== Verificação: nome_fantasia ===\n");

  // 1. Check column exists
  const { data: ws, error } = await sb
    .from("workspaces")
    .select("id, nome, nome_fantasia")
    .limit(10);

  if (error) {
    console.error("❌ Coluna nome_fantasia NÃO encontrada:", error.message);
    console.log('\nRode no Supabase SQL Editor:');
    console.log('  ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS nome_fantasia text;');
    process.exit(1);
  }

  console.log("✅ Coluna nome_fantasia existe");
  console.log(`   Workspaces: ${ws?.length ?? 0} encontrados`);
  for (const w of ws ?? []) {
    console.log(`   - ${w.nome} | fantasia: ${w.nome_fantasia ?? "(vazio)"}`);
  }

  console.log("\n✅ Migração verificada com sucesso!\n");
}

verify();
