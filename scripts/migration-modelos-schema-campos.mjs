/**
 * Migration: adicionar schema_campos à tabela modelos
 *
 * Execute o SQL abaixo no Supabase SQL Editor:
 *
 * ALTER TABLE modelos ADD COLUMN IF NOT EXISTS schema_campos jsonb;
 *
 * Essa coluna armazena o schema de campos gerado automaticamente
 * a partir das variáveis extraídas do .docx na criação do modelo.
 * Formato: array de objetos { key, label, type, required, placeholder?, options? }
 */

console.log("=== Migration: modelos.schema_campos ===\n");
console.log("Execute no Supabase SQL Editor:\n");
console.log("ALTER TABLE modelos ADD COLUMN IF NOT EXISTS schema_campos jsonb;\n");
console.log("Essa coluna armazena o schema de campos inferido do .docx.");
console.log("Formato: [{key, label, type, required}]");
