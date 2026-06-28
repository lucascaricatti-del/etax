"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import type { CampoSchema } from "@/lib/types";

interface TipoContrato {
  id: string;
  nome: string;
  slug: string;
}

interface WorkspaceRef {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
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
  schema_campos: CampoSchema[] | null;
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
      .map((id) => {
        const w = workspaces.find((w) => w.id === id);
        return w ? w.nome_fantasia || w.nome : id.slice(0, 8);
      })
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
                  {m.variaveis.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{m.variaveis.length} variáveis</span>
                    </>
                  )}
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

// ---------------------------------------------------------------------------
// Tipo dos campos do schema editável
// ---------------------------------------------------------------------------

const TIPO_CAMPO_OPTIONS: { value: CampoSchema["type"]; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Telefone" },
  { value: "select", label: "Seleção" },
];

// ---------------------------------------------------------------------------
// ModeloForm — criação via upload .docx OU edição manual
// ---------------------------------------------------------------------------

type UploadResult = {
  clicksign_template_key: string;
  variaveis: string[];
  schema_campos: CampoSchema[];
};

function ModeloForm({
  modelo,
  tiposContrato,
  workspaces,
  onClose,
  onSaved,
}: {
  modelo: ModeloRow | null;
  tiposContrato: { id: string; nome: string }[];
  workspaces: { id: string; nome: string; nome_fantasia?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!modelo;

  // --- State: campos do modelo ---
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [descricao, setDescricao] = useState(modelo?.descricao ?? "");
  const [tipoContratoId, setTipoContratoId] = useState(modelo?.tipo_contrato_id ?? "");
  const [templateKey, setTemplateKey] = useState(modelo?.clicksign_template_key ?? "");
  const [natureza, setNatureza] = useState(modelo?.natureza_financeira ?? "neutro");
  const [disponibilidade, setDisponibilidade] = useState(modelo?.disponibilidade ?? "todas");
  const [selectedWs, setSelectedWs] = useState<string[]>(
    modelo?.modelo_empresas?.map((me) => me.workspace_id) ?? []
  );
  const [variaveis, setVariaveis] = useState<string[]>(modelo?.variaveis ?? []);
  const [schemaCampos, setSchemaCampos] = useState<CampoSchema[]>(
    modelo?.schema_campos ?? []
  );
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true);

  // --- State: upload ---
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(isEdit); // edição pula upload
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State: save ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWs(wsId: string) {
    setSelectedWs((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId]
    );
  }

  // --- Upload .docx ---
  async function handleUpload(file: File) {
    if (!nome.trim()) {
      setUploadError("Preencha o nome do modelo antes de enviar o arquivo");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("nome", nome.trim());

    try {
      const res = await fetch("/api/modelos/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Erro ao processar arquivo");
        return;
      }

      const result = data as UploadResult;
      setTemplateKey(result.clicksign_template_key);
      setVariaveis(result.variaveis);
      setSchemaCampos(result.schema_campos);
      setUploadDone(true);
      setFileName(file.name);
    } catch {
      setUploadError("Erro de conexão ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  // --- Editar campo do schema ---
  function updateSchemaField(
    index: number,
    field: keyof CampoSchema,
    value: string | boolean
  ) {
    setSchemaCampos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  // --- Salvar modelo ---
  async function handleSubmit() {
    if (!nome.trim() || !tipoContratoId || !templateKey.trim()) {
      setError("Preencha nome, tipo de contrato e envie o arquivo .docx");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      tipo_contrato_id: tipoContratoId,
      clicksign_template_key: templateKey.trim(),
      natureza_financeira: natureza,
      disponibilidade,
      variaveis,
      schema_campos: schemaCampos.length > 0 ? schemaCampos : null,
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

          {/* Upload .docx (criação) ou Template Key (edição) */}
          {!isEdit ? (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Arquivo .docx
              </label>

              {!uploadDone ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="etax-btn etax-btn-ghost w-full min-h-[48px] border-2 border-dashed border-[var(--color-line)] hover:border-[var(--color-primary)]"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        Processando...
                      </span>
                    ) : (
                      "Selecionar arquivo .docx"
                    )}
                  </button>
                  <p className="text-xs text-[var(--color-text-mute)] mt-1">
                    O arquivo deve conter variáveis no formato {"{{VARIAVEL}}"}. O template será criado automaticamente na ClickSign.
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-[var(--radius-btn)] bg-[var(--color-status-ok-bg)] border border-[var(--color-status-ok)]">
                  <svg className="h-4 w-4 text-[var(--color-status-ok)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-[var(--color-status-ok)]">
                    {fileName} — template criado na ClickSign
                  </span>
                </div>
              )}

              {uploadError && (
                <div className="mt-2 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
                  {uploadError}
                </div>
              )}
            </div>
          ) : (
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
          )}

          {/* Schema dos campos (aparece após upload ou na edição se existir) */}
          {schemaCampos.length > 0 && (
            <fieldset className="border border-[var(--color-line)] rounded-[var(--radius-card)] p-4 space-y-3">
              <legend className="text-xs font-semibold text-[var(--color-text-mute)] uppercase px-1">
                Variáveis extraídas ({schemaCampos.length})
              </legend>
              <p className="text-xs text-[var(--color-text-mute)]">
                Edite os nomes de exibição e tipos dos campos antes de salvar.
              </p>

              <div className="space-y-3">
                {schemaCampos.map((campo, i) => (
                  <div
                    key={campo.key}
                    className="border border-[var(--color-line)] rounded-[var(--radius-btn)] p-3 space-y-2"
                  >
                    {/* Variável */}
                    <p className="font-mono text-xs text-[var(--color-text-mute)]">
                      {"{{"}{variaveis[i] || campo.key.toUpperCase()}{"}}"}
                    </p>

                    {/* Label editável */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={campo.label}
                          onChange={(e) =>
                            updateSchemaField(i, "label", e.target.value)
                          }
                          className="etax-input min-h-[40px] text-sm"
                          placeholder="Nome de exibição"
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={campo.type}
                          onChange={(e) =>
                            updateSchemaField(i, "type", e.target.value)
                          }
                          className="etax-input min-h-[40px] text-sm"
                        >
                          {TIPO_CAMPO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Obrigatório */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campo.required}
                        onChange={(e) =>
                          updateSchemaField(i, "required", e.target.checked)
                        }
                        className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                      />
                      <span className="text-xs text-[var(--color-text-soft)]">
                        Obrigatório
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          {/* Variáveis manual (só na edição sem schema) */}
          {isEdit && schemaCampos.length === 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Variáveis (separadas por vírgula)
              </label>
              <input
                type="text"
                value={variaveis.join(", ")}
                onChange={(e) =>
                  setVariaveis(
                    e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean)
                  )
                }
                className="etax-input min-h-[48px] font-mono text-xs"
                placeholder="RAZAO_SOCIAL, CNPJ, EMAIL"
              />
            </div>
          )}

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
                      <span className="text-sm text-[var(--color-text)]">
                        {ws.nome_fantasia || ws.nome}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedWs.length > 0 && (
                <p className="text-xs text-[var(--color-text-mute)] mt-1">
                  {selectedWs.length}{" "}
                  {selectedWs.length === 1
                    ? "empresa selecionada"
                    : "empresas selecionadas"}
                </p>
              )}
            </div>
          )}

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
            disabled={loading || uploading}
            className="etax-btn etax-btn-ghost w-full sm:w-auto min-h-[48px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || uploading || (!isEdit && !uploadDone)}
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
