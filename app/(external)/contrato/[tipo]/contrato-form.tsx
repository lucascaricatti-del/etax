"use client";

import { useState } from "react";
import type { CampoSchema, TipoContrato } from "@/lib/types";

export function ContratoForm({
  tipoContrato,
}: {
  tipoContrato: TipoContrato;
}) {
  const [dados, setDados] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(key: string, value: string) {
    setDados((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_contrato_id: tipoContrato.id,
          dados,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao enviar solicitação");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao enviar solicitação"
      );
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800 mb-2">
          Solicitação enviada!
        </h2>
        <p className="text-green-700">
          Sua solicitação de contrato {tipoContrato.nome} foi recebida e será
          processada pela equipe jurídica.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {tipoContrato.schema_campos.map((campo) => (
        <FieldInput
          key={campo.key}
          campo={campo}
          value={dados[campo.key] ?? ""}
          onChange={(v) => handleChange(campo.key, v)}
        />
      ))}

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {status === "loading" ? "Enviando..." : "Enviar solicitação"}
      </button>
    </form>
  );
}

function FieldInput({
  campo,
  value,
  onChange,
}: {
  campo: CampoSchema;
  value: string;
  onChange: (value: string) => void;
}) {
  const baseClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {campo.label}
        {campo.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {campo.type === "select" ? (
        <select
          required={campo.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
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
          required={campo.required}
          placeholder={campo.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      )}
    </div>
  );
}
