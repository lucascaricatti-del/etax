"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampoSchema } from "@/lib/types";
import { CampoInput, validateForm } from "@/components/campo-input";
import { ParcelasInput } from "@/components/parcelas-input";
import type { Parcela } from "@/lib/parcelas";

type FormValue = string | number | Parcela[];

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
  workspaces: Array<{ id: string; nome: string; nome_fantasia?: string | null }>;
  isEtax: boolean;
  defaultWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [dados, setDados] = useState<Record<string, FormValue>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const tipoSelecionado = tipos.find((t) => t.id === tipoId);

  function handleTipoChange(id: string) {
    setTipoId(id);
    setDados({});
    setFieldErrors({});
  }

  function handleFieldChange(key: string, value: FormValue) {
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

    if (tipoSelecionado) {
      const errors = validateForm(dados, tipoSelecionado.schema_campos);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setStatus("error");
        setErrorMessage("Corrija os campos destacados.");
        return;
      }
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
          tipo_contrato_id: tipoId,
          dados,
          workspace_id: resolvedWorkspaceId,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao criar solicitação");
      }

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
        className="etax-btn etax-btn-primary"
      >
        Nova solicitação
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="etax-card space-y-4"
    >
      <h2 className="etax-section-label">Nova solicitação</h2>

      {isEtax && (
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
            Empresa <span className="text-[var(--color-status-danger)] ml-0.5">*</span>
          </label>
          <select
            required
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="etax-input"
          >
            <option value="">Selecione a empresa...</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nome_fantasia || w.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          Tipo de contrato <span className="text-[var(--color-status-danger)] ml-0.5">*</span>
        </label>
        <select
          required
          value={tipoId}
          onChange={(e) => handleTipoChange(e.target.value)}
          className="etax-input"
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
        tipoSelecionado.schema_campos.map((campo) =>
          campo.type === "parcelas" ? (
            <ParcelasInput
              key={campo.key}
              campo={campo}
              value={dados[campo.key]}
              onChange={(v) => handleFieldChange(campo.key, v)}
              valorTotal={
                typeof dados.valor_total === "number"
                  ? dados.valor_total
                  : undefined
              }
              error={fieldErrors[campo.key]}
            />
          ) : (
            <CampoInput
              key={campo.key}
              campo={campo}
              value={dados[campo.key] as string | number | undefined}
              onChange={(v) => handleFieldChange(campo.key, v)}
              error={fieldErrors[campo.key]}
            />
          )
        )}

      {status === "error" && errorMessage && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {errorMessage}
        </div>
      )}

      {tipoSelecionado && (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={status === "loading"}
            className="etax-btn etax-btn-primary"
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
              setFieldErrors({});
            }}
            className="etax-btn etax-btn-ghost"
          >
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
