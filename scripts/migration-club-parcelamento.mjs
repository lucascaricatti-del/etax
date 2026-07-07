/**
 * Migração: parcelamento flexível no Club.
 *
 * Substitui o campo select 'forma_pgto' pelo campo 'parcelas'
 * (type: "parcelas") no schema_campos do tipo 'club'.
 *
 * O modelo ClickSign NÃO muda: na geração do contrato, as parcelas são
 * consolidadas num texto único enviado na variável FORMA_PGTO
 * (lib/parcelas.ts#consolidarFormaPgto).
 *
 * Idempotente. Rodar: node scripts/migration-club-parcelamento.mjs
 * (com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const PARCELAS_FIELD = {
  key: "parcelas",
  label: "Parcelamento",
  type: "parcelas",
  required: true,
};

const { data: tipo, error } = await sb
  .from("tipos_contrato")
  .select("id, schema_campos")
  .eq("slug", "club")
  .single();

if (error || !tipo) {
  console.error("Tipo 'club' não encontrado:", error?.message);
  process.exit(1);
}

const schema = Array.isArray(tipo.schema_campos) ? tipo.schema_campos : [];

if (schema.some((c) => c.key === "parcelas")) {
  console.log("Já migrado: campo 'parcelas' presente no schema do Club.");
  process.exit(0);
}

const idx = schema.findIndex((c) => c.key === "forma_pgto");
const next = [...schema];
if (idx >= 0) {
  next[idx] = PARCELAS_FIELD;
} else {
  next.push(PARCELAS_FIELD);
}

const { error: errUpdate } = await sb
  .from("tipos_contrato")
  .update({ schema_campos: next })
  .eq("id", tipo.id);

if (errUpdate) {
  console.error("Erro ao atualizar schema do Club:", errUpdate.message);
  process.exit(1);
}

console.log(
  idx >= 0
    ? "✓ Club: 'forma_pgto' substituído por 'parcelas' (parcelamento flexível)."
    : "✓ Club: campo 'parcelas' adicionado (forma_pgto não existia)."
);
console.log("Campos do Club:", next.map((c) => c.key).join(", "));
