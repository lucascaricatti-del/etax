"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, ScanText, Save } from "lucide-react";

interface WorkspaceOption {
  id: string;
  nome: string;
  nome_fantasia: string | null;
}

interface TipoOption {
  id: string;
  nome: string;
  slug: string;
}

interface ModeloOption {
  id: string;
  nome: string | null;
  versao: number | null;
  tipo_contrato_id: string;
  workspace_id: string | null;
  natureza_financeira: string | null;
}

interface Campos {
  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
  valor: string;
  assinado_em: string;
  vigencia_inicio: string;
  vigencia_fim: string;
}

const CAMPOS_VAZIOS: Campos = {
  nome: "",
  cpf_cnpj: "",
  email: "",
  telefone: "",
  valor: "",
  assinado_em: "",
  vigencia_inicio: "",
  vigencia_fim: "",
};

export function ImportarContratoForm({
  workspaces,
  tipos,
  modelos,
}: {
  workspaces: WorkspaceOption[];
  tipos: TipoOption[];
  modelos: ModeloOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workspaceId, setWorkspaceId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [campos, setCampos] = useState<Campos | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoSelecionado = tipos.find((t) => t.id === tipoId);

  const modelosDisponiveis = useMemo(
    () =>
      modelos.filter(
        (m) =>
          m.tipo_contrato_id === tipoId &&
          (m.workspace_id === null || m.workspace_id === workspaceId)
      ),
    [modelos, tipoId, workspaceId]
  );

  const prontoParaLer = workspaceId && tipoId && file;

  function handleFileChange(f: File | null) {
    setFile(f);
    setCampos(null);
    setError(null);
  }

  async function handleExtrair() {
    if (!file) return;
    setExtraindo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/contratos/importar/extrair", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao ler o PDF");
        return;
      }

      const c = data.campos ?? {};
      setCampos({
        nome: c.nome ?? "",
        cpf_cnpj: c.cpf_cnpj ?? "",
        email: c.email ?? "",
        telefone: c.telefone ?? "",
        valor: c.valor_total != null ? String(c.valor_total) : "",
        assinado_em: c.data_assinatura ?? "",
        vigencia_inicio: c.vigencia_inicio ?? "",
        vigencia_fim: c.vigencia_fim ?? "",
      });
    } catch {
      setError("Erro de conexão");
    } finally {
      setExtraindo(false);
    }
  }

  async function handleImportar() {
    if (!file || !campos) return;
    setImportando(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "payload",
        JSON.stringify({
          workspace_id: workspaceId,
          tipo: tipoSelecionado?.slug ?? "",
          modelo_id: modeloId || null,
          nome: campos.nome,
          cpf_cnpj: campos.cpf_cnpj,
          email: campos.email || null,
          telefone: campos.telefone || null,
          valor: campos.valor ? parseFloat(campos.valor) : null,
          assinado_em: campos.assinado_em || null,
          vigencia_inicio: campos.vigencia_inicio || null,
          vigencia_fim: campos.vigencia_fim || null,
        })
      );

      const res = await fetch("/api/contratos/importar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao importar contrato");
        return;
      }

      router.push(`/contratos/${data.id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setImportando(false);
    }
  }

  function setCampo(key: keyof Campos, value: string) {
    setCampos((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Passo 1 — contexto + PDF */}
      <div className="etax-card space-y-4">
        <h2 className="etax-section-label">1. Empresa, tipo e PDF</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Empresa *
            </label>
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="etax-input w-full min-h-[48px]"
            >
              <option value="">Selecione a empresa</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nome_fantasia || w.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Tipo de contrato *
            </label>
            <select
              value={tipoId}
              onChange={(e) => {
                setTipoId(e.target.value);
                setModeloId("");
              }}
              className="etax-input w-full min-h-[48px]"
            >
              <option value="">Selecione o tipo</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
            Modelo (opcional — define receita/despesa no dashboard)
          </label>
          <select
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            disabled={!tipoId}
            className="etax-input w-full min-h-[48px]"
          >
            <option value="">Sem modelo</option>
            {modelosDisponiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome || `Modelo v${m.versao}`}
                {m.natureza_financeira ? ` (${m.natureza_financeira})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
            PDF do contrato assinado * (máx 4MB)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-text-soft)] file:mr-3 file:rounded-[var(--radius-btn)] file:border-0 file:bg-[var(--color-sidebar)] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExtrair}
            disabled={!prontoParaLer || extraindo || importando}
            className="etax-btn etax-btn-primary min-h-[48px] disabled:opacity-50"
          >
            {extraindo ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Lendo PDF...
              </>
            ) : (
              <>
                <ScanText size={16} />
                Ler PDF com IA
              </>
            )}
          </button>
          <button
            onClick={() => setCampos({ ...CAMPOS_VAZIOS })}
            disabled={!prontoParaLer || extraindo || importando}
            className="etax-btn etax-btn-ghost min-h-[48px] disabled:opacity-50"
          >
            Preencher manualmente
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      {/* Passo 2 — revisão */}
      {campos && (
        <div className="etax-card space-y-4">
          <h2 className="etax-section-label">2. Revise os dados extraídos</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Nome / Razão social da contratante *
              </label>
              <input
                type="text"
                value={campos.nome}
                onChange={(e) => setCampo("nome", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                CPF / CNPJ *
              </label>
              <input
                type="text"
                value={campos.cpf_cnpj}
                onChange={(e) => setCampo("cpf_cnpj", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Valor total (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={campos.valor}
                onChange={(e) => setCampo("valor", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={campos.email}
                onChange={(e) => setCampo("email", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={campos.telefone}
                onChange={(e) => setCampo("telefone", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Data de assinatura
              </label>
              <input
                type="date"
                value={campos.assinado_em}
                onChange={(e) => setCampo("assinado_em", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Início da vigência
              </label>
              <input
                type="date"
                value={campos.vigencia_inicio}
                onChange={(e) => setCampo("vigencia_inicio", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Fim da vigência
              </label>
              <input
                type="date"
                value={campos.vigencia_fim}
                onChange={(e) => setCampo("vigencia_fim", e.target.value)}
                className="etax-input w-full min-h-[48px]"
              />
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-soft)]">
            O contrato entra como <strong>assinado</strong>, conta no dashboard
            financeiro e o PDF fica disponível para download no detalhe.
          </p>

          <button
            onClick={handleImportar}
            disabled={
              importando ||
              extraindo ||
              !campos.nome.trim() ||
              !campos.cpf_cnpj.trim()
            }
            className="etax-btn etax-btn-primary w-full sm:w-auto min-h-[48px] disabled:opacity-50"
          >
            {importando ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importando...
              </>
            ) : (
              <>
                <Save size={16} />
                Importar contrato
              </>
            )}
          </button>
        </div>
      )}

      {!campos && (
        <div className="etax-card border-dashed text-center py-6">
          <FileUp
            size={20}
            className="mx-auto mb-2 text-[var(--color-text-mute)]"
          />
          <p className="text-sm text-[var(--color-text-mute)]">
            Selecione empresa, tipo e o PDF, depois clique em &quot;Ler PDF com
            IA&quot; para preencher os dados automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
