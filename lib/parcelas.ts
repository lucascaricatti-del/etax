/**
 * Parcelamento flexível (tipo Club).
 *
 * Canônico salvo em dados.parcelas: Array<{ metodo, valor, data }>
 *   - metodo: string (Pix, Boleto, Cartão de crédito, Transferência bancária)
 *   - valor: number em reais (ex: 20000.00)
 *   - data: string ISO yyyy-mm-dd
 *
 * O modelo ClickSign NÃO muda: na geração do contrato, as parcelas são
 * consolidadas num texto único enviado na variável FORMA_PGTO.
 */

export interface Parcela {
  metodo: string;
  valor: number;
  data: string; // ISO yyyy-mm-dd
}

export const METODOS_PARCELA = [
  "Pix",
  "Boleto",
  "Cartão de crédito",
  "Transferência bancária",
] as const;

/** Interpreta um valor desconhecido como lista de parcelas (forma canônica). */
export function parseParcelas(value: unknown): Parcela[] {
  if (!Array.isArray(value)) return [];
  const out: Parcela[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    out.push({
      metodo: typeof it.metodo === "string" ? it.metodo : "",
      valor: coerceValor(it.valor),
      data: typeof it.data === "string" ? it.data.slice(0, 10) : "",
    });
  }
  return out;
}

/** Normaliza para persistência: descarta linhas vazias; null se nada sobrar. */
export function normalizeParcelas(value: unknown): Parcela[] | null {
  const parcelas = parseParcelas(value).filter(
    (p) => p.metodo || p.valor > 0 || p.data
  );
  return parcelas.length > 0 ? parcelas : null;
}

export function somaParcelas(parcelas: Parcela[]): number {
  return parcelas.reduce((acc, p) => acc + (p.valor || 0), 0);
}

/** Valida a lista de parcelas (client e server). */
export function validateParcelas(
  value: unknown,
  required: boolean
): string | null {
  const parcelas = parseParcelas(value).filter(
    (p) => p.metodo || p.valor > 0 || p.data
  );
  if (parcelas.length === 0)
    return required ? "Adicione ao menos uma parcela" : null;
  for (const p of parcelas) {
    if (!p.metodo) return "Selecione o método de todas as parcelas";
    if (!p.valor || p.valor <= 0) return "Informe o valor de todas as parcelas";
    if (!p.data) return "Informe a data de todas as parcelas";
  }
  return null;
}

/** R$ 1.234,56 — espaço normal (sem nbsp), pois o texto vai para o contrato. */
export function formatParcelaBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(valor)
    .replace(/\u00a0/g, " ");
}

/** Rótulo da parcela por posição (UI e texto consolidado). */
export function rotuloParcela(index: number, total: number): string {
  if (total <= 1) return "Parcela única";
  return index === 0 ? "Entrada" : `${index + 1}ª parcela`;
}

/**
 * Consolida as parcelas num texto legível para a variável FORMA_PGTO.
 * Ex.: "Entrada de R$ 20.000,00 via Pix em 07/07/2026; 2ª parcela de
 * R$ 5.000,00 via Boleto em 08/08/2026"
 */
export function consolidarFormaPgto(parcelas: Parcela[]): string {
  return parcelas
    .map((p, i) => {
      const rotulo = rotuloParcela(i, parcelas.length);
      return `${rotulo} de ${formatParcelaBRL(p.valor)} via ${p.metodo} em ${formatParcelaData(p.data)}`;
    })
    .join("; ");
}

function formatParcelaData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function coerceValor(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const str = String(v);
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  const digits = str.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) / 100 : 0;
}
