"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function ExcluirSolicitacaoButton({
  solicitacaoId,
  temContrato,
}: {
  solicitacaoId: string;
  temContrato: boolean;
}) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleExcluir() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao excluir");
        return;
      }

      router.push("/solicitacoes");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (show) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-status-danger)]">
            Excluir definitivamente
          </h3>

          <p className="text-sm text-[var(--color-text-soft)] mb-6">
            Isso apaga a solicitação do banco
            {temContrato
              ? " junto com o contrato gerado, os eventos de assinatura e o PDF"
              : ""}
            . Esta ação NÃO pode ser desfeita.
          </p>

          {error && (
            <div className="mb-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={() => {
                setShow(false);
                setError(null);
              }}
              disabled={loading}
              className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleExcluir}
              disabled={loading}
              className="etax-btn w-full sm:w-auto min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Excluindo...
                </>
              ) : (
                "Excluir de vez"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShow(true)}
      className="etax-btn etax-btn-danger min-h-[48px]"
    >
      <Trash2 size={16} />
      Excluir
    </button>
  );
}
