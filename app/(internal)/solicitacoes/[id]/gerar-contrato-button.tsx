"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GerarContratoButton({
  solicitacaoId,
  signerNome,
  signerEmail,
}: {
  solicitacaoId: string;
  signerNome: string;
  signerEmail: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitacaoId}/gerar-contrato`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao gerar contrato");
        return;
      }

      setShowConfirm(false);
      router.refresh();
    } catch {
      setError("Erro de conexão ao gerar contrato");
    } finally {
      setLoading(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
            Confirmar geração do contrato
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
              <span className="text-xs text-[var(--color-text-mute)] uppercase">E-mail</span>
              <p className="text-sm font-semibold">
                {signerEmail || (
                  <span className="text-[var(--color-status-danger)]">
                    E-mail não cadastrado
                  </span>
                )}
              </p>
            </div>
          </div>

          {!signerEmail && (
            <p className="text-sm text-[var(--color-status-danger)] mb-4">
              O campo &quot;email&quot; do representante não está preenchido nos dados
              da solicitação. Edite os dados antes de gerar o contrato.
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowConfirm(false);
                setError(null);
              }}
              disabled={loading}
              className="etax-btn etax-btn-ghost"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !signerEmail}
              className="etax-btn etax-btn-primary"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Gerando...
                </>
              ) : (
                "Confirmar e gerar"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="etax-btn etax-btn-primary"
    >
      Gerar contrato
    </button>
  );
}
