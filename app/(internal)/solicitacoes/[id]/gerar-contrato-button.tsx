"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GerarContratoButton({
  solicitacaoId,
  contraparteNome,
  contraparteEmail,
}: {
  solicitacaoId: string;
  contraparteNome: string;
  contraparteEmail: string | null;
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
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4">
            Confirmar geração do contrato
          </h3>

          <p className="text-sm text-gray-600 mb-3">
            O contrato será enviado para assinatura de:
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4 space-y-2">
            <div>
              <span className="text-xs text-gray-500 uppercase">
                Signatário
              </span>
              <p className="text-sm font-semibold">{contraparteNome}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">E-mail</span>
              <p className="text-sm font-semibold">
                {contraparteEmail || (
                  <span className="text-red-600">
                    E-mail não cadastrado
                  </span>
                )}
              </p>
            </div>
          </div>

          {!contraparteEmail && (
            <p className="text-sm text-red-600 mb-4">
              A contraparte não tem e-mail cadastrado. Edite os dados antes de
              gerar o contrato.
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !contraparteEmail}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
    >
      Gerar contrato
    </button>
  );
}
