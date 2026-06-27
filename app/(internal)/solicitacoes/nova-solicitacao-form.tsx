"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampoSchema } from "@/lib/types";

interface TipoOption {
  id: string;
  nome: string;
  schema_campos: CampoSchema[];
}

export function NovaSolicitacaoForm({
  tipos,
  workspaces,
  isEtax,
  defaultWorkspaceId,
}: {
  tipos: TipoOption[];
  workspaces: Array<{ id: string; nome: string }>;
  isEtax: boolean;
  defaultWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [dados, setDados] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const tipoSelecionado = tipos.find((t) => t.id === tipoId);

  function handleTipoChange(id: string) {
    setTipoId(id);
    setDados({});
  }

  function handleFieldChange(key: string, value: string) {
    setDados((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

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
          tipo_contrato_id: tipoId,
          dados,
          workspace_id: resolvedWorkspaceId,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao criar solicitação");
      }

      // Reset and close
      setTipoId("");
      setWorkspaceId("");
      setDados({});
      setOpen(false);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao criar solicitação"
      );
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Nova solicitação
      </button>
    );
  }

  const baseClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 p-5 space-y-4"
    >
      <h2 className="text-sm font-semibold">Nova solicitação</h2>

      {isEtax && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            required
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className={baseClass}
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de contrato <span className="text-red-500 ml-0.5">*</span>
        </label>
        <select
          required
          value={tipoId}
          onChange={(e) => handleTipoChange(e.target.value)}
          className={baseClass}
        >
          <option value="">Selecione o tipo...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {tipoSelecionado &&
        tipoSelecionado.schema_campos.map((campo) => (
          <FieldInput
            key={campo.key}
            campo={campo}
            value={dados[campo.key] ?? ""}
            onChange={(v) => handleFieldChange(campo.key, v)}
          />
        ))}

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {tipoSelecionado && (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === "loading" ? "Enviando..." : "Enviar solicitação"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTipoId("");
              setDados({});
              setWorkspaceId("");
              setStatus("idle");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      )}
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
