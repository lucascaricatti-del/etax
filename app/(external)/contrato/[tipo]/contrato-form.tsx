"use client";

import { useState } from "react";
import type { TipoContrato } from "@/lib/types";
import { CampoInput, validateForm } from "@/components/campo-input";

export function ContratoForm({
  tipoContrato,
  isEtax,
  workspaces,
  defaultWorkspaceId,
}: {
  tipoContrato: TipoContrato;
  isEtax: boolean;
  workspaces: Array<{ id: string; nome: string }>;
  defaultWorkspaceId: string | null;
}) {
  const [dados, setDados] = useState<Record<string, string | number>>({});
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId ?? "");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleChange(key: string, value: string | number) {
    setDados((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(dados, tipoContrato.schema_campos);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus("error");
      setErrorMessage("Corrija os campos destacados.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setFieldErrors({});

    const resolvedWorkspaceId = isEtax ? workspaceId : defaultWorkspaceId;
    if (!resolvedWorkspaceId) {
      setStatus("error");
      setErrorMessage("Selecione a empresa.");
      return;
    }

    try {
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_contrato_id: tipoContrato.id,
          dados,
          workspace_id: resolvedWorkspaceId,
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

  const selectClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEtax && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            required
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className={selectClass}
          >
            <option value="">Selecione a empresa...</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {tipoContrato.schema_campos.map((campo) => (
        <CampoInput
          key={campo.key}
          campo={campo}
          value={dados[campo.key]}
          onChange={(v) => handleChange(campo.key, v)}
          error={fieldErrors[campo.key]}
        />
      ))}

      {status === "error" && errorMessage && (
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
