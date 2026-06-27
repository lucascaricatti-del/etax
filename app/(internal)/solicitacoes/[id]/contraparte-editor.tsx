"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inferMask, applyMask, formatCanonical, validateField } from "@/lib/masks";

interface ContraparteData {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  tipo_pessoa: "PF" | "PJ";
  email: string | null;
  telefone: string | null;
}

const fieldDefs = [
  { key: "nome", label: "Nome / Razão Social", required: true },
  { key: "cpf_cnpj", label: "CPF/CNPJ", required: false },
  { key: "email", label: "E-mail da empresa", required: false },
  { key: "telefone", label: "Telefone", required: false },
] as const;

const inputClass =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
const errorInputClass =
  "block w-full rounded-lg border border-red-400 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none";

export function ContraparteEditor({
  contraparte,
  canEdit,
}: {
  contraparte: ContraparteData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function startEditing() {
    setFormData({
      nome: contraparte.nome ?? "",
      cpf_cnpj: contraparte.cpf_cnpj ?? "",
      email: contraparte.email ?? "",
      telefone: contraparte.telefone ?? "",
    });
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

  function getMask(key: string) {
    if (key === "cpf_cnpj") {
      // Detect by digit count: 14 = cnpj, else cpf
      const digits = (formData.cpf_cnpj ?? "").replace(/\D/g, "");
      return digits.length > 11 ? "cnpj" as const : "cpf" as const;
    }
    if (key === "telefone") return "phone" as const;
    if (key === "email") return "email" as const;
    return null;
  }

  function getDisplayMask(key: string) {
    if (key === "cpf_cnpj") {
      const digits = (contraparte.cpf_cnpj ?? "").replace(/\D/g, "");
      return digits.length === 14 ? "cnpj" as const : "cpf" as const;
    }
    if (key === "telefone") return "phone" as const;
    if (key === "email") return "email" as const;
    return null;
  }

  function handleChange(key: string, rawInput: string) {
    const mask = getMask(key);

    if (!mask || mask === "email") {
      setFormData((prev) => ({ ...prev, [key]: rawInput }));
    } else {
      const digits = rawInput.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [key]: digits }));
    }

    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function getInputDisplay(key: string): string {
    const val = formData[key] ?? "";
    if (!val) return "";
    const mask = getMask(key);
    if (!mask || mask === "email") return val;
    return applyMask(val, mask);
  }

  async function handleSave() {
    const errors: Record<string, string> = {};

    // Validate nome (required)
    if (!formData.nome?.trim()) {
      errors.nome = "Campo obrigatório";
    }

    // Validate cpf_cnpj if provided
    if (formData.cpf_cnpj) {
      const digits = formData.cpf_cnpj.replace(/\D/g, "");
      const mask = digits.length > 11 ? "cnpj" as const : "cpf" as const;
      const err = validateField(digits, mask, false);
      if (err) errors.cpf_cnpj = err;
    }

    // Validate email if provided
    if (formData.email) {
      const err = validateField(formData.email, "email", false);
      if (err) errors.email = err;
    }

    // Validate telefone if provided
    if (formData.telefone) {
      const err = validateField(formData.telefone, "phone", false);
      if (err) errors.telefone = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Corrija os campos destacados.");
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch(`/api/contrapartes/${contraparte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          cpf_cnpj: formData.cpf_cnpj || null,
          email: formData.email || null,
          telefone: formData.telefone || null,
        }),
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

  function displayValue(key: string): string {
    const val = contraparte[key as keyof ContraparteData];
    if (val == null || val === "") return "—";
    const mask = getDisplayMask(key);
    if (mask) return formatCanonical(val, mask);
    return String(val);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">
          Contraparte
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
        <div className="space-y-3">
          {fieldDefs.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              <input
                type={field.key === "email" ? "email" : "text"}
                inputMode={
                  field.key === "cpf_cnpj" || field.key === "telefone"
                    ? "tel"
                    : undefined
                }
                value={getInputDisplay(field.key)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={
                  fieldErrors[field.key] ? errorInputClass : inputClass
                }
              />
              {fieldErrors[field.key] && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          {fieldDefs.map((field) => (
            <div key={field.key}>
              <dt className="text-gray-500">{field.label}</dt>
              <dd className="font-medium">{displayValue(field.key)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
