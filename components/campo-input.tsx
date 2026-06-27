"use client";

import { useMemo } from "react";
import type { CampoSchema } from "@/lib/types";
import { inferMask, applyMask, validateField, type MaskType } from "@/lib/masks";

const inputClass =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
const errorInputClass =
  "block w-full rounded-lg border border-red-400 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none";

/**
 * Input com máscara controlada.
 *
 * - value: valor canônico (number para BRL, string de dígitos para doc, string para texto)
 * - onChange: emite valor canônico
 * - error: mensagem de erro (opcional, vinda de validação externa)
 */
export function CampoInput({
  campo,
  value,
  onChange,
  error,
}: {
  campo: CampoSchema;
  value: string | number | undefined;
  onChange: (canonical: string | number) => void;
  error?: string | null;
}) {
  const mask = inferMask(campo.key, campo.type);

  // Converte valor canônico → display para o input
  const displayValue = useMemo(() => {
    return canonicalToDisplay(value, mask);
  }, [value, mask]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawInput = e.target.value;

    if (!mask || mask === "email") {
      onChange(rawInput);
      return;
    }

    const digits = rawInput.replace(/\D/g, "");

    if (mask === "brl") {
      const centavos = parseInt(digits || "0", 10);
      const reais = centavos / 100;
      onChange(reais === 0 ? "" : reais);
    } else {
      onChange(digits);
    }
  }

  if (campo.type === "select") {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {campo.label}
          {campo.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={error ? errorInputClass : inputClass}
        >
          <option value="">Selecione...</option>
          {campo.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Campos com máscara usam type="text" + inputMode numérico
  if (mask && mask !== "email") {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {campo.label}
          {campo.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type="text"
          inputMode={mask === "brl" ? "numeric" : "tel"}
          value={displayValue}
          onChange={handleChange}
          placeholder={campo.placeholder}
          className={error ? errorInputClass : inputClass}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Campos sem máscara ou email
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {campo.label}
        {campo.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={campo.type}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={campo.placeholder}
        className={error ? errorInputClass : inputClass}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validação em lote (para formulários)
// ---------------------------------------------------------------------------

export function validateForm(
  dados: Record<string, string | number>,
  schema: CampoSchema[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const campo of schema) {
    const mask = inferMask(campo.key, campo.type);
    const err = validateField(dados[campo.key], mask, campo.required);
    if (err) errors[campo.key] = err;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function canonicalToDisplay(value: unknown, mask: MaskType): string {
  if (value == null || value === "") return "";
  if (!mask || mask === "email") return String(value);

  if (mask === "brl") {
    let reais: number;
    if (typeof value === "number") {
      reais = value;
    } else {
      // String — old format (centavos) ou string de dígitos
      const str = String(value);
      if (/^\d+\.\d+$/.test(str)) {
        reais = parseFloat(str);
      } else {
        const digits = str.replace(/\D/g, "");
        if (!digits) return "";
        reais = parseInt(digits, 10) / 100;
      }
    }
    if (reais === 0) return "";
    const centavos = Math.round(reais * 100);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(centavos / 100);
  }

  // Para doc masks: extrair dígitos e aplicar máscara
  const digits = String(value).replace(/\D/g, "");
  return applyMask(digits, mask);
}
