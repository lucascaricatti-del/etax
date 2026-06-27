/**
 * Funções de formatação para exibição.
 * Delegam para lib/masks.ts (a fonte única de lógica de formatação).
 */

import { formatCanonical, formatForClickSign } from "@/lib/masks";

/** Formata valor canônico → "R$ 150.000,00" para exibição. */
export function formatBRL(value: unknown): string {
  return formatCanonical(value, "brl");
}

/** Formata valor canônico → "150.000,00" para ClickSign (sem R$). */
export function formatValorClickSign(value: unknown): string {
  return formatForClickSign(value, "brl");
}
