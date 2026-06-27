"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Modelo } from "@/lib/types";

export function EnviarAprovacaoButton({
  solicitacaoId,
  tipoContratoId,
  workspaceId,
  signerNome,
  signerEmail,
}: {
  solicitacaoId: string;
  tipoContratoId: string;
  workspaceId: string | null;
  signerNome: string;
  signerEmail: string | null;
}) {
  const [showModal, setShowModal] = useState(false);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [selectedModeloId, setSelectedModeloId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!showModal) return;

    async function fetchModelos() {
      setLoadingModelos(true);
      try {
        const params = new URLSearchParams({ tipo_contrato_id: tipoContratoId });
        if (workspaceId) params.set("workspace_id", workspaceId);
        const res = await fetch(`/api/modelos?${params}`);
        if (res.ok) {
          const data = await res.json();
          setModelos(data);
          if (data.length === 1) setSelectedModeloId(data[0].id);
        }
      } catch {
        setError("Erro ao carregar modelos");
      } finally {
        setLoadingModelos(false);
      }
    }

    fetchModelos();
  }, [showModal, tipoContratoId, workspaceId]);

  async function handleSubmit() {
    if (!selectedModeloId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitacaoId}/enviar-aprovacao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelo_id: selectedModeloId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao enviar para aprovação");
        return;
      }

      setShowModal(false);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const selectedModelo = modelos.find((m) => m.id === selectedModeloId);

  if (showModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
            Enviar para aprovação
          </h3>

          <p className="text-sm text-[var(--color-text-soft)] mb-3">
            O contrato será enviado para assinatura de:
          </p>

          <div className="rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-bg)] p-4 mb-4 space-y-2">
            <div>
              <span className="text-xs text-[var(--color-text-mute)] uppercase">
                Representante / Signatário
              </span>
              <p className="text-sm font-semibold">{signerNome}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-mute)] uppercase">
                E-mail
              </span>
              <p className="text-sm font-semibold">
                {signerEmail || (
                  <span className="text-[var(--color-status-danger)]">
                    E-mail não cadastrado
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Model selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Modelo do contrato
            </label>
            {loadingModelos ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-mute)]">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-text-mute)] border-t-transparent" />
                Carregando modelos...
              </div>
            ) : modelos.length === 0 ? (
              <p className="text-sm text-[var(--color-status-danger)]">
                Nenhum modelo disponível para este tipo de contrato
              </p>
            ) : (
              <select
                value={selectedModeloId}
                onChange={(e) => setSelectedModeloId(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-bg)] text-sm text-[var(--color-text)]"
              >
                <option value="">Selecione um modelo</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome || `Modelo v${m.versao}`}
                    {m.workspace_id ? "" : " (padrão)"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected model description */}
          {selectedModelo?.descricao && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-mute)] uppercase mb-1">
                Descrição do modelo
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                {selectedModelo.descricao}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={() => {
                setShowModal(false);
                setError(null);
                setSelectedModeloId("");
              }}
              disabled={loading}
              className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedModeloId}
              className="etax-btn etax-btn-primary w-full sm:w-auto min-h-[48px]"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando...
                </>
              ) : (
                "Enviar para aprovação"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowModal(true)}
      className="etax-btn etax-btn-primary"
    >
      Enviar para aprovação
    </button>
  );
}
