"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";

interface TipoContrato {
  id: string;
  nome: string;
  slug: string;
}

interface WorkspaceRef {
  id: string;
  nome: string;
}

interface ModeloRow {
  id: string;
  nome: string | null;
  descricao: string | null;
  tipo_contrato_id: string;
  clicksign_template_key: string;
  natureza_financeira: string;
  disponibilidade: string;
  variaveis: string[];
  versao: number;
  ativo: boolean;
  criado_em: string;
  tipo_contrato: TipoContrato | null;
  modelo_empresas: { workspace_id: string }[];
}

const NATUREZA_LABELS: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
  neutro: "Neutro",
};

const NATUREZA_COLORS: Record<string, string> = {
  receita: "text-[var(--color-status-ok)] bg-[var(--color-status-ok-bg)]",
  despesa: "text-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)]",
  neutro: "text-[var(--color-status-info)] bg-[var(--color-status-info-bg)]",
};

export function ModelosList({
  modelos,
  tiposContrato,
  workspaces,
}: {
  modelos: ModeloRow[];
  tiposContrato: TipoContrato[];
  workspaces: WorkspaceRef[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingModelo, setEditingModelo] = useState<ModeloRow | null>(null);
  const router = useRouter();

  function openNew() {
    setEditingModelo(null);
    setShowForm(true);
  }

  function openEdit(m: ModeloRow) {
    setEditingModelo(m);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingModelo(null);
  }

  function wsNamesForModelo(m: ModeloRow): string {
    if (m.disponibilidade === "todas") return "Todas";
    const ids = m.modelo_empresas?.map((me) => me.workspace_id) ?? [];
    if (ids.length === 0) return "Nenhuma";
    const names = ids
      .map((id) => workspaces.find((w) => w.id === id)?.nome ?? id.slice(0, 8))
      .join(", ");
    return names;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="font-heading text-3xl font-semibold text-[var(--color-text)]">
          Modelos
        </h1>
        <button onClick={openNew} className="etax-btn etax-btn-primary min-h-[48px]">
          Novo modelo
        </button>
      </div>

      {modelos.length === 0 ? (
        <div className="etax-card text-center py-8">
          <p className="text-sm text-[var(--color-text-mute)]">Nenhum modelo cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {modelos.map((m) => {
            const tc = m.tipo_contrato as unknown as TipoContrato | null;

            return (
              <div
                key={m.id}
                className={`etax-card cursor-pointer hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99] ${!m.ativo ? "opacity-50" : ""}`}
                onClick={() => openEdit(m)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                      {m.nome || `Modelo v${m.versao}`}
                    </p>
                    {m.descricao && (
                      <p className="text-xs text-[var(--color-text-soft)] mt-0.5 line-clamp-1">
                        {m.descricao}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${NATUREZA_COLORS[m.natureza_financeira] ?? NATUREZA_COLORS.neutro}`}
                    >
                      {NATUREZA_LABELS[m.natureza_financeira] ?? m.natureza_financeira}
                    </span>
                    <StatusBadge status={m.ativo ? "vigente" : "encerrado"} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-[var(--color-text-soft)] flex-wrap">
                  <span>{tc?.nome ?? "—"}</span>
                  <span>·</span>
                  <span>v{m.versao}</span>
                  <span>·</span>
                  <span>
                    {m.disponibilidade === "todas" ? "Todas as empresas" : wsNamesForModelo(m)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ModeloForm
          modelo={editingModelo}
          tiposContrato={tiposContrato}
          workspaces={workspaces}
          onClose={closeForm}
          onSaved={() => {
            closeForm();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ModeloForm({
  modelo,
  tiposContrato,
  workspaces,
  onClose,
  onSaved,
}: {
  modelo: ModeloRow | null;
  tiposContrato: { id: string; nome: string }[];
  workspaces: { id: string; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!modelo;

  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [descricao, setDescricao] = useState(modelo?.descricao ?? "");
  const [tipoContratoId, setTipoContratoId] = useState(modelo?.tipo_contrato_id ?? "");
  const [templateKey, setTemplateKey] = useState(modelo?.clicksign_template_key ?? "");
  const [natureza, setNatureza] = useState(modelo?.natureza_financeira ?? "neutro");
  const [disponibilidade, setDisponibilidade] = useState(modelo?.disponibilidade ?? "todas");
  const [selectedWs, setSelectedWs] = useState<string[]>(
    modelo?.modelo_empresas?.map((me) => me.workspace_id) ?? []
  );
  const [variaveisText, setVariaveisText] = useState(
    (modelo?.variaveis ?? []).join(", ")
  );
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWs(wsId: string) {
    setSelectedWs((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId]
    );
  }

  async function handleSubmit() {
    if (!nome.trim() || !tipoContratoId || !templateKey.trim()) {
      setError("Preencha nome, tipo de contrato e template key");
      return;
    }

    setLoading(true);
    setError(null);

    const variaveis = variaveisText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      tipo_contrato_id: tipoContratoId,
      clicksign_template_key: templateKey.trim(),
      natureza_financeira: natureza,
      disponibilidade,
      variaveis,
      ativo,
      workspace_ids: disponibilidade === "especificas" ? selectedWs : [],
    };

    try {
      const url = isEdit ? `/api/modelos/${modelo.id}` : "/api/modelos";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar");
        return;
      }

      onSaved();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 overflow-y-auto">
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
          {isEdit ? "Editar modelo" : "Novo modelo"}
        </h3>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="etax-input min-h-[48px]"
              placeholder="Ex: Club v2"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="etax-input min-h-[72px] resize-none"
              placeholder="Descrição opcional do modelo"
              rows={2}
            />
          </div>

          {/* Tipo de contrato */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Tipo de contrato
            </label>
            <select
              value={tipoContratoId}
              onChange={(e) => setTipoContratoId(e.target.value)}
              className="etax-input min-h-[48px]"
            >
              <option value="">Selecione</option>
              {tiposContrato.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.nome}
                </option>
              ))}
            </select>
          </div>

          {/* ClickSign Template Key */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              ClickSign Template Key
            </label>
            <input
              type="text"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="etax-input min-h-[48px] font-mono text-xs"
              placeholder="uuid do template na ClickSign"
            />
          </div>

          {/* Natureza financeira */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Natureza financeira
            </label>
            <select
              value={natureza}
              onChange={(e) => setNatureza(e.target.value)}
              className="etax-input min-h-[48px]"
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
              <option value="neutro">Neutro</option>
            </select>
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Disponibilidade
            </label>
            <select
              value={disponibilidade}
              onChange={(e) => setDisponibilidade(e.target.value)}
              className="etax-input min-h-[48px]"
            >
              <option value="todas">Todas as empresas</option>
              <option value="especificas">Empresas específicas</option>
            </select>
          </div>

          {/* Multiselect de empresas */}
          {disponibilidade === "especificas" && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Empresas
              </label>
              <div className="border border-[var(--color-line)] rounded-[var(--radius-btn)] bg-[var(--color-bg)] p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {workspaces.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-mute)] p-2">
                    Nenhuma empresa cadastrada
                  </p>
                ) : (
                  workspaces.map((ws) => (
                    <label
                      key={ws.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-[var(--radius-btn)] hover:bg-[var(--color-card)] cursor-pointer min-h-[44px]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWs.includes(ws.id)}
                        onChange={() => toggleWs(ws.id)}
                        className="w-4 h-4 rounded accent-[var(--color-accent)]"
                      />
                      <span className="text-sm text-[var(--color-text)]">{ws.nome}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedWs.length > 0 && (
                <p className="text-xs text-[var(--color-text-mute)] mt-1">
                  {selectedWs.length} {selectedWs.length === 1 ? "empresa selecionada" : "empresas selecionadas"}
                </p>
              )}
            </div>
          )}

          {/* Variáveis */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Variáveis (separadas por vírgula)
            </label>
            <input
              type="text"
              value={variaveisText}
              onChange={(e) => setVariaveisText(e.target.value)}
              className="etax-input min-h-[48px] font-mono text-xs"
              placeholder="razao_social, cnpj, email, valor_total"
            />
          </div>

          {/* Ativo */}
          <label className="flex items-center gap-2 cursor-pointer min-h-[48px]">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text)]">Modelo ativo</span>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="etax-btn etax-btn-primary w-full sm:w-auto min-h-[48px]"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Salvando...
              </>
            ) : isEdit ? (
              "Salvar"
            ) : (
              "Criar modelo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
