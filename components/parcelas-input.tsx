"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CampoSchema } from "@/lib/types";
import {
  METODOS_PARCELA,
  parseParcelas,
  somaParcelas,
  formatParcelaBRL,
  rotuloParcela,
  type Parcela,
} from "@/lib/parcelas";

const EMPTY_PARCELA: Parcela = { metodo: "", valor: 0, data: "" };

/**
 * Lista dinâmica de parcelas (parcelamento flexível do Club).
 * Mobile-first: campos empilhados no mobile, grid de 3 colunas no sm+.
 * Mostra a soma em tempo real e avisa (sem bloquear) se divergir do valor total.
 */
export function ParcelasInput({
  campo,
  value,
  onChange,
  valorTotal,
  error,
}: {
  campo: CampoSchema;
  value: unknown;
  onChange: (parcelas: Parcela[]) => void;
  valorTotal?: number;
  error?: string | null;
}) {
  const parsed = parseParcelas(value);
  const parcelas = parsed.length > 0 ? parsed : [{ ...EMPTY_PARCELA }];

  const soma = somaParcelas(parcelas);
  const temValores = soma > 0;
  const temTotal = typeof valorTotal === "number" && valorTotal > 0;
  const somaDiverge = temValores && temTotal && Math.abs(soma - valorTotal) >= 0.005;

  function updateParcela(index: number, patch: Partial<Parcela>) {
    onChange(parcelas.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addParcela() {
    onChange([...parcelas, { ...EMPTY_PARCELA }]);
  }

  function removeParcela(index: number) {
    const next = parcelas.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ ...EMPTY_PARCELA }]);
  }

  function handleValorChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    updateParcela(index, { valor: digits ? parseInt(digits, 10) / 100 : 0 });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
        {campo.label}
        {campo.required && (
          <span className="text-[var(--color-status-danger)] ml-0.5">*</span>
        )}
      </label>

      <div className="space-y-3">
        {parcelas.map((p, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--color-line)] p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-mute)]">
                {rotuloParcela(i, parcelas.length)}
              </span>
              {parcelas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParcela(i)}
                  aria-label={`Remover ${rotuloParcela(i, parcelas.length)}`}
                  className="text-[var(--color-text-mute)] hover:text-[var(--color-status-danger)] p-1 -m-1"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={p.metodo}
                onChange={(e) => updateParcela(i, { metodo: e.target.value })}
                className="etax-input"
                aria-label="Método de pagamento"
              >
                <option value="">Método...</option>
                {METODOS_PARCELA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="text"
                inputMode="numeric"
                value={p.valor > 0 ? formatParcelaBRL(p.valor) : ""}
                onChange={(e) => handleValorChange(i, e.target.value)}
                placeholder="R$ 0,00"
                className="etax-input"
                aria-label="Valor da parcela"
              />

              <input
                type="date"
                value={p.data}
                onChange={(e) => updateParcela(i, { data: e.target.value })}
                className="etax-input"
                aria-label="Vencimento da parcela"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addParcela}
          className="etax-btn etax-btn-ghost w-full sm:w-auto"
        >
          <Plus size={16} />
          Adicionar parcela
        </button>

        {temValores && (
          <p className="text-sm text-[var(--color-text-soft)]">
            Soma das parcelas:{" "}
            <span className="font-medium">{formatParcelaBRL(soma)}</span>
            {temTotal && (
              <>
                {" "}
                · Valor total do contrato:{" "}
                <span className="font-medium">{formatParcelaBRL(valorTotal)}</span>
              </>
            )}
          </p>
        )}

        {somaDiverge && (
          <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-warn)] bg-[var(--color-status-warn-bg)] p-3 text-sm text-[var(--color-status-warn)]">
            A soma das parcelas ({formatParcelaBRL(soma)}) difere do valor total
            do contrato ({formatParcelaBRL(valorTotal)}).
          </div>
        )}

        {error && (
          <p className="text-xs text-[var(--color-status-danger)]">{error}</p>
        )}
      </div>
    </div>
  );
}
