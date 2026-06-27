/**
 * ClickSign helpers.
 *
 * Normalização de variáveis:
 * No banco e no formulário, as keys são minúsculas (ex: razao_social, cnpj).
 * A ClickSign espera variáveis em MAIÚSCULAS (ex: RAZAO_SOCIAL, CNPJ).
 * A função `toTemplateData` converte automaticamente.
 */

/**
 * Converte um objeto de dados do formulário (keys minúsculas)
 * para o formato template.data da ClickSign (keys MAIÚSCULAS).
 *
 * Exemplo:
 *   toTemplateData({ razao_social: "Acme Ltda", cnpj: "12.345.678/0001-00" })
 *   // => { RAZAO_SOCIAL: "Acme Ltda", CNPJ: "12.345.678/0001-00" }
 */
export function toTemplateData(
  dados: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(dados)) {
    result[key.toUpperCase()] = String(value ?? "");
  }
  return result;
}
