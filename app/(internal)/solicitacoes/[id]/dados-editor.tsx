"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampoSchema } from "@/lib/types";
import { formatBRL } from "@/lib/format";

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
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    // Inicializa formData com valores atuais
    const initial: Record<string, string> = {};
    for (const campo of schema) {
      initial[campo.key] = String(dados[campo.key] ?? "");
    }
    setFormData(initial);
    setEditing(true);
    setError(null);
  }

  function cancelEditing() {
    setEditing(false);
    setFormData({});
    setError(null);
  }

  function handleChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

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
    if (val == null || val === "") return "—";
    if (campo.key === "valor_total") return formatBRL(val);
    return String(val);
  }

  const inputClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <div className="rounded-lg border border-gray-200 p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">
          Dados do formulário
        </h2>
        {canEdit && !editing && (
          <button
            onClick={startEditing}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Editar
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {editing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {schema.map((campo) => (
            <div key={campo.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {campo.label}
                {campo.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              {campo.type === "select" ? (
                <select
                  value={formData[campo.key] ?? ""}
                  onChange={(e) => handleChange(campo.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione...</option>
                  {campo.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={campo.type}
                  value={formData[campo.key] ?? ""}
                  onChange={(e) => handleChange(campo.key, e.target.value)}
                  placeholder={campo.placeholder}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {schema.map((campo) => (
            <div key={campo.key}>
              <dt className="text-sm text-gray-500">{campo.label}</dt>
              <dd className="text-sm font-medium">{displayValue(campo)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
