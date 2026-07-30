"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  GitBranch,
  FileX2,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CircleCheck,
  Pencil,
  Undo2,
} from "lucide-react";
import { Tooltip } from "@/components/tooltip";

interface ContratoData {
  id: string;
  status_assinatura: string;
  natureza_documento: string;
  conta_no_dashboard: boolean;
  contrato_pai_id: string | null;
  excluido_em: string | null;
  workspace_id: string | null;
  inadimplente_em: string | null;
  valor_inadimplencia: number | null;
  inadimplencia_observacao: string | null;
  data_distrato: string | null;
  valor_distrato: number | null;
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
  const [showEditarDistrato, setShowEditarDistrato] = useState(false);
  const [showDesfazerDistrato, setShowDesfazerDistrato] = useState(false);
  const [showAditivo, setShowAditivo] = useState(false);
  const [showExcluir, setShowExcluir] = useState(false);
  const [showExcluirDef, setShowExcluirDef] = useState(false);
  const [showInadimplencia, setShowInadimplencia] = useState(false);
  const [showRegularizar, setShowRegularizar] = useState(false);

  // Distrato fields (prefill com valores atuais p/ edição)
  const [dataDistrato, setDataDistrato] = useState(contrato.data_distrato ?? "");
  const [valorDistrato, setValorDistrato] = useState(
    contrato.valor_distrato != null ? String(contrato.valor_distrato) : ""
  );

  // Inadimplência fields
  const [dataInadimplencia, setDataInadimplencia] = useState("");
  const [valorInadimplencia, setValorInadimplencia] = useState("");
  const [obsInadimplencia, setObsInadimplencia] = useState("");

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
      setShowEditarDistrato(false);
      setShowDesfazerDistrato(false);
      setShowAditivo(false);
      setShowExcluir(false);
      setShowInadimplencia(false);
      setShowRegularizar(false);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  async function doHardDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao excluir definitivamente");
        return;
      }
      router.push("/contratos");
      router.refresh();
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
  const isInadimplente = !!contrato.inadimplente_em && isAssinado;

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

      {/* Restored state */}
      {isExcluido ? (
        <button
          onClick={() => doAction("restaurar")}
          disabled={loading}
          className="etax-btn etax-btn-primary w-full min-h-[48px]"
        >
          <RotateCcw size={16} />
          Restaurar contrato
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Neutral actions */}
          <button
            onClick={() => doAction("toggle_dashboard")}
            disabled={loading}
            className="etax-btn etax-btn-secondary w-full min-h-[48px] justify-between"
          >
            <span className="flex items-center gap-2">
              <BarChart3 size={16} />
              {contrato.conta_no_dashboard
                ? "Excluir do dashboard"
                : "Incluir no dashboard"}
            </span>
            <Tooltip text="Controla se este contrato aparece nos KPIs financeiros" />
          </button>

          {isPrincipal && !isDistratado && (
            <>
              {!showAditivo ? (
                <button
                  onClick={() => setShowAditivo(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-secondary w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <GitBranch size={16} />
                    Marcar como aditivo
                  </span>
                  <Tooltip text="Vincula como aditivo de outro contrato principal" />
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

          {/* Inadimplência — contrato segue assinado; é marcação de risco reversível */}
          {isAssinado && !isInadimplente && (
            <>
              {!showInadimplencia ? (
                <button
                  onClick={() => setShowInadimplencia(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-secondary w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Marcar inadimplência
                  </span>
                  <Tooltip text="Sinaliza atraso de pagamento. Não altera a receita — aparece como valor em risco. Reversível." />
                </button>
              ) : (
                <div className="etax-card p-4 space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Marcar como inadimplente
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                      Inadimplente desde
                    </label>
                    <input
                      type="date"
                      value={dataInadimplencia}
                      onChange={(e) => setDataInadimplencia(e.target.value)}
                      className="etax-input w-full min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                      Valor em aberto (R$) — opcional
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorInadimplencia}
                      onChange={(e) => setValorInadimplencia(e.target.value)}
                      className="etax-input w-full min-h-[48px]"
                      placeholder="Se vazio, usa o valor do contrato"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                      Observação — opcional
                    </label>
                    <input
                      type="text"
                      value={obsInadimplencia}
                      onChange={(e) => setObsInadimplencia(e.target.value)}
                      className="etax-input w-full min-h-[48px]"
                      placeholder="Ex.: 3 parcelas em atraso, em negociação"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowInadimplencia(false)}
                      className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() =>
                        doAction("marcar_inadimplente", {
                          inadimplente_em: dataInadimplencia,
                          valor_inadimplencia: valorInadimplencia || null,
                          inadimplencia_observacao: obsInadimplencia || null,
                        })
                      }
                      disabled={loading || !dataInadimplencia}
                      className="etax-btn etax-btn-primary flex-1 min-h-[48px]"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {isInadimplente && (
            <>
              {!showRegularizar ? (
                <button
                  onClick={() => setShowRegularizar(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-secondary w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <CircleCheck size={16} />
                    Regularizar inadimplência
                  </span>
                  <Tooltip text="Remove a marcação de inadimplência (pagamento regularizado)" />
                </button>
              ) : (
                <div className="etax-card p-4 space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Confirmar regularização?
                  </p>
                  <p className="text-xs text-[var(--color-text-soft)]">
                    O contrato deixa de aparecer como inadimplente e sai do
                    valor em risco.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRegularizar(false)}
                      className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => doAction("regularizar_inadimplencia")}
                      disabled={loading}
                      className="etax-btn etax-btn-primary flex-1 min-h-[48px]"
                    >
                      Regularizar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Divider */}
          <div className="border-t border-[var(--color-line)] my-2" />

          {/* Destructive actions */}
          {isAssinado && (
            <>
              {!showDistrato ? (
                <button
                  onClick={() => setShowDistrato(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-danger w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileX2 size={16} />
                    Registrar distrato
                  </span>
                  <Tooltip text="Registra o distrato formal com data e valor" />
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

          {/* Ajustes de distrato — contrato já distratado */}
          {isDistratado && (
            <>
              {!showEditarDistrato ? (
                <button
                  onClick={() => setShowEditarDistrato(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-secondary w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Pencil size={16} />
                    Editar distrato
                  </span>
                  <Tooltip text="Corrige data e valor do distrato. O churn no financeiro recalcula automaticamente." />
                </button>
              ) : (
                <div className="etax-card p-4 space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Corrigir distrato
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
                      onClick={() => setShowEditarDistrato(false)}
                      className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() =>
                        doAction("editar_distrato", {
                          data_distrato: dataDistrato,
                          valor_distrato: parseFloat(valorDistrato),
                        })
                      }
                      disabled={loading || !dataDistrato || !valorDistrato}
                      className="etax-btn etax-btn-primary flex-1 min-h-[48px]"
                    >
                      Salvar correção
                    </button>
                  </div>
                </div>
              )}

              {!showDesfazerDistrato ? (
                <button
                  onClick={() => setShowDesfazerDistrato(true)}
                  disabled={loading}
                  className="etax-btn etax-btn-danger w-full min-h-[48px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Undo2 size={16} />
                    Desfazer distrato
                  </span>
                  <Tooltip text="Reverte o distrato: contrato volta a assinado e o churn é removido do financeiro" />
                </button>
              ) : (
                <div className="etax-card p-4 space-y-3 border border-[var(--color-status-danger)]">
                  <p className="text-sm font-medium text-[var(--color-status-danger)]">
                    Desfazer o distrato deste contrato?
                  </p>
                  <p className="text-xs text-[var(--color-text-soft)]">
                    O contrato volta ao status assinado e o valor deixa de
                    contar como churn no financeiro.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDesfazerDistrato(false)}
                      className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => doAction("desfazer_distrato")}
                      disabled={loading}
                      className="etax-btn flex-1 min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90"
                    >
                      Desfazer distrato
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!showExcluir ? (
            <button
              onClick={() => setShowExcluir(true)}
              disabled={loading}
              className="etax-btn etax-btn-danger w-full min-h-[48px] justify-between"
            >
              <span className="flex items-center gap-2">
                <Trash2 size={16} />
                Excluir contrato
              </span>
              <Tooltip text="Remove dos cálculos e listagens. Pode ser restaurado." />
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
        </div>
      )}

      {/* Hard delete — sempre disponível para admin (inclusive em contrato soft-deleted) */}
      <div className="border-t border-[var(--color-line)] pt-3 mt-2">
        {!showExcluirDef ? (
          <button
            onClick={() => setShowExcluirDef(true)}
            disabled={loading}
            className="etax-btn etax-btn-danger w-full min-h-[48px] justify-between"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={16} />
              Excluir definitivamente
            </span>
            <Tooltip text="Apaga do banco: contrato, eventos de assinatura, PDF e a solicitação vinculada. NÃO pode ser desfeito." />
          </button>
        ) : (
          <div className="etax-card p-4 space-y-3 border border-[var(--color-status-danger)]">
            <p className="text-sm font-medium text-[var(--color-status-danger)]">
              Excluir DEFINITIVAMENTE este contrato?
            </p>
            <p className="text-xs text-[var(--color-text-soft)]">
              Isso apaga do banco o contrato, os eventos de assinatura, o PDF
              assinado e a solicitação vinculada. Esta ação NÃO pode ser
              desfeita.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExcluirDef(false)}
                disabled={loading}
                className="etax-btn etax-btn-ghost flex-1 min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={doHardDelete}
                disabled={loading}
                className="etax-btn flex-1 min-h-[48px] bg-[var(--color-status-danger)] text-white hover:opacity-90"
              >
                {loading ? "Excluindo..." : "Excluir de vez"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
