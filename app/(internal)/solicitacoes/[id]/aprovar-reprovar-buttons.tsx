"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AprovarReprovarButtons({
  solicitacaoId,
}: {
  solicitacaoId: string;
}) {
  const [showAprovar, setShowAprovar] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAprovar() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitacaoId}/aprovar`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao aprovar");
        return;
      }

      setShowAprovar(false);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  async function handleReprovar() {
    if (!motivo.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitacaoId}/reprovar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao reprovar");
        return;
      }

      setShowReprovar(false);
      setMotivo("");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  // Approve confirmation modal
  if (showAprovar) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
            Confirmar aprovação
          </h3>

          <p className="text-sm text-[var(--color-text-soft)] mb-6">
            Deseja aprovar esta solicitação? Após a aprovação, o contrato poderá ser gerado e enviado para assinatura.
          </p>

          {error && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={() => {
                setShowAprovar(false);
                setError(null);
              }}
              disabled={loading}
              className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleAprovar}
              disabled={loading}
              className="etax-btn w-full sm:w-auto min-h-[48px] bg-[var(--color-status-ok)] text-white hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Aprovando...
                </>
              ) : (
                "Confirmar aprovação"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reject modal with textarea
  if (showReprovar) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
            Reprovar solicitação
          </h3>

          <p className="text-sm text-[var(--color-text-soft)] mb-3">
            Informe o motivo da reprovação. A solicitação voltará para o status &quot;em confecção&quot;.
          </p>

          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da reprovação..."
            rows={3}
            className="w-full min-h-[96px] px-3 py-2 rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] resize-none mb-4"
          />

          {error && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={() => {
                setShowReprovar(false);
                setError(null);
                setMotivo("");
              }}
              disabled={loading}
              className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleReprovar}
              disabled={loading || !motivo.trim()}
              className="etax-btn w-full sm:w-auto min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Reprovando...
                </>
              ) : (
                "Confirmar reprovação"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: two buttons
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setShowAprovar(true)}
        className="etax-btn min-h-[48px] bg-[var(--color-status-ok)] text-white hover:opacity-90 transition-opacity"
      >
        Aprovar
      </button>
      <button
        onClick={() => setShowReprovar(true)}
        className="etax-btn min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90 transition-opacity"
      >
        Reprovar
      </button>
    </div>
  );
}
