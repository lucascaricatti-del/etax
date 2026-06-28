"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ContratoData {
  id: string;
  status_assinatura: string;
  natureza_documento: string;
  conta_no_dashboard: boolean;
  contrato_pai_id: string | null;
  excluido_em: string | null;
  workspace_id: string | null;
}

interface ContratoOption {
  id: string;
  label: string;
}

export function ContratoAdminActions({
  contrato,
  possiveisPais,
}: {
  contrato: ContratoData;
  possiveisPais: ContratoOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDistrato, setShowDistrato] = useState(false);
  const [showAditivo, setShowAditivo] = useState(false);
  const [showExcluir, setShowExcluir] = useState(false);

  // Distrato fields
  const [dataDistrato, setDataDistrato] = useState("");
  const [valorDistrato, setValorDistrato] = useState("");

  // Aditivo fields
  const [contratoPaiId, setContratoPaiId] = useState("");

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao executar ação");
        return;
      }
      router.refresh();
      setShowDistrato(false);
      setShowAditivo(false);
      setShowExcluir(false);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const isExcluido = !!contrato.excluido_em;
  const isAssinado = contrato.status_assinatura === "assinado";
  const isPrincipal = contrato.natureza_documento === "principal";
  const isDistratado = contrato.status_assinatura === "distratado";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide">
        Ações administrativas
      </h3>

      {error && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* Toggle dashboard */}
        <button
          onClick={() => doAction("toggle_dashboard")}
          disabled={loading}
          className="etax-btn etax-btn-ghost w-full min-h-[48px] text-left justify-start"
        >
          {contrato.conta_no_dashboard
            ? "Excluir do dashboard"
            : "Incluir no dashboard"}
        </button>

        {/* Marcar como aditivo */}
        {isPrincipal && !isDistratado && !isExcluido && (
          <>
            {!showAditivo ? (
              <button
                onClick={() => setShowAditivo(true)}
                disabled={loading}
                className="etax-btn etax-btn-ghost w-full min-h-[48px] text-left justify-start"
              >
                Marcar como aditivo
              </button>
            ) : (
              <div className="etax-card p-4 space-y-3">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Vincular como aditivo de qual contrato?
                </p>
                <select
                  value={contratoPaiId}
                  onChange={(e) => setContratoPaiId(e.target.value)}
                  className="etax-input w-full min-h-[48px]"
                >
                  <option value="">Selecione o contrato principal</option>
                  {possiveisPais.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAditivo(false)}
                    className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() =>
                      doAction("marcar_aditivo", { contrato_pai_id: contratoPaiId })
                    }
                    disabled={loading || !contratoPaiId}
                    className="etax-btn etax-btn-primary flex-1 min-h-[48px]"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Registrar distrato */}
        {isAssinado && !isExcluido && (
          <>
            {!showDistrato ? (
              <button
                onClick={() => setShowDistrato(true)}
                disabled={loading}
                className="etax-btn etax-btn-ghost w-full min-h-[48px] text-left justify-start text-[var(--color-status-danger)]"
              >
                Registrar distrato
              </button>
            ) : (
              <div className="etax-card p-4 space-y-3">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Registrar distrato
                </p>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                    Data do distrato
                  </label>
                  <input
                    type="date"
                    value={dataDistrato}
                    onChange={(e) => setDataDistrato(e.target.value)}
                    className="etax-input w-full min-h-[48px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                    Valor real do distrato (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorDistrato}
                    onChange={(e) => setValorDistrato(e.target.value)}
                    className="etax-input w-full min-h-[48px]"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDistrato(false)}
                    className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() =>
                      doAction("registrar_distrato", {
                        data_distrato: dataDistrato,
                        valor_distrato: parseFloat(valorDistrato),
                      })
                    }
                    disabled={loading || !dataDistrato || !valorDistrato}
                    className="etax-btn flex-1 min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90"
                  >
                    Confirmar distrato
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Excluir / Restaurar */}
        {!isExcluido ? (
          <>
            {!showExcluir ? (
              <button
                onClick={() => setShowExcluir(true)}
                disabled={loading}
                className="etax-btn etax-btn-ghost w-full min-h-[48px] text-left justify-start text-[var(--color-status-danger)]"
              >
                Excluir contrato
              </button>
            ) : (
              <div className="etax-card p-4 space-y-3 border border-[var(--color-status-danger)]">
                <p className="text-sm font-medium text-[var(--color-status-danger)]">
                  Confirma exclusão deste contrato?
                </p>
                <p className="text-xs text-[var(--color-text-soft)]">
                  O contrato será removido dos cálculos e listagens. Pode ser restaurado depois.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowExcluir(false)}
                    className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => doAction("excluir")}
                    disabled={loading}
                    className="etax-btn flex-1 min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => doAction("restaurar")}
            disabled={loading}
            className="etax-btn etax-btn-primary w-full min-h-[48px]"
          >
            Restaurar contrato
          </button>
        )}
      </div>
    </div>
  );
}
