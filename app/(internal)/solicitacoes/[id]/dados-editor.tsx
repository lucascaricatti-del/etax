"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampoSchema } from "@/lib/types";
import { inferMask, formatCanonical } from "@/lib/masks";
import { CampoInput, validateForm } from "@/components/campo-input";
import { ParcelasInput } from "@/components/parcelas-input";
import {
  parseParcelas,
  consolidarFormaPgto,
  type Parcela,
} from "@/lib/parcelas";

type FormValue = string | number | Parcela[];

export function DadosEditor({
  solicitacaoId,
  dados,
  schema,
  canEdit,
}: {
  solicitacaoId: string;
  dados: Record<string, unknown>;
  schema: CampoSchema[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, FormValue>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function startEditing() {
    const initial: Record<string, FormValue> = {};
    for (const campo of schema) {
      const val = dados[campo.key];
      if (campo.type === "parcelas") {
        initial[campo.key] = parseParcelas(val);
      } else if (val == null || val === "") {
        initial[campo.key] = "";
      } else if (typeof val === "number") {
        initial[campo.key] = val;
      } else {
        initial[campo.key] = String(val);
      }
    }
    setFormData(initial);
    setEditing(true);
    setError(null);
    setFieldErrors({});
  }

  function cancelEditing() {
    setEditing(false);
    setFormData({});
    setError(null);
    setFieldErrors({});
  }

  function handleChange(key: string, value: FormValue) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSave() {
    const errors = validateForm(formData, schema);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Corrija os campos destacados.");
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: formData }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Erro ao salvar");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Erro de conexão ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function displayValue(campo: CampoSchema): string {
    const val = dados[campo.key];
    if (campo.type === "parcelas") {
      const parcelas = parseParcelas(val);
      return parcelas.length > 0 ? consolidarFormaPgto(parcelas) : "—";
    }
    if (val == null || val === "") return "—";
    const mask = inferMask(campo.key, campo.type);
    if (mask) return formatCanonical(val, mask);
    return String(val);
  }

  return (
    <div className="etax-card md:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="etax-section-label !mb-0">
          Dados do formulário
        </h2>
        {canEdit && !editing && (
          <button
            onClick={startEditing}
            className="text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
          >
            Editar
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="etax-btn etax-btn-primary py-1.5 px-3"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="etax-btn etax-btn-ghost py-1.5 px-3"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      {editing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {schema.map((campo) =>
            campo.type === "parcelas" ? (
              <div key={campo.key} className="sm:col-span-2">
                <ParcelasInput
                  campo={campo}
                  value={formData[campo.key]}
                  onChange={(v) => handleChange(campo.key, v)}
                  valorTotal={
                    typeof formData.valor_total === "number"
                      ? formData.valor_total
                      : undefined
                  }
                  error={fieldErrors[campo.key]}
                />
              </div>
            ) : (
              <CampoInput
                key={campo.key}
                campo={campo}
                value={formData[campo.key] as string | number | undefined}
                onChange={(v) => handleChange(campo.key, v)}
                error={fieldErrors[campo.key]}
              />
            )
          )}
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {schema.map((campo) => (
            <div
              key={campo.key}
              className={campo.type === "parcelas" ? "sm:col-span-2" : undefined}
            >
              <dt className="text-sm text-[var(--color-text-mute)]">{campo.label}</dt>
              <dd className="text-sm font-medium">{displayValue(campo)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
