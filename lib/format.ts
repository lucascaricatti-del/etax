/**
 * Formatação de valores monetários.
 *
 * valor_total é armazenado como número cru em centavos (ex: 15000000 = R$ 150.000,00).
 * Estas funções convertem para exibição e para envio à ClickSign.
 */

/** Formata centavos → "R$ 150.000,00" para exibição na tela. */
export function formatBRL(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = String(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  const centavos = parseInt(digits, 10);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/** Formata centavos → "150.000,00" para template.data da ClickSign (sem prefixo R$). */
export function formatValorClickSign(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  const centavos = parseInt(digits, 10);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}
