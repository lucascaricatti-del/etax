"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Workspace {
  id: string;
  nome: string;
  nome_fantasia: string | null;
}

interface Config {
  id?: string;
  workspace_id: string;
  clicksign_token: string;
  contratada_nome: string;
  contratada_email: string;
  contratada_auto: boolean;
  testemunha1_nome: string;
  testemunha1_email: string;
  testemunha2_nome: string;
  testemunha2_email: string;
}

const EMPTY_CONFIG: Omit<Config, "workspace_id"> = {
  clicksign_token: "",
  contratada_nome: "",
  contratada_email: "",
  contratada_auto: false,
  testemunha1_nome: "",
  testemunha1_email: "",
  testemunha2_nome: "",
  testemunha2_email: "",
};

export function ConfigAssinatura({
  workspaces,
  configs,
}: {
  workspaces: Workspace[];
  configs: (Config & { workspace?: Workspace })[];
}) {
  const router = useRouter();
  const [selectedWsId, setSelectedWsId] = useState<string>("");
  const [form, setForm] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Track which workspaces already have config
  const configuredIds = new Set(configs.map((c) => c.workspace_id));

  useEffect(() => {
    if (!selectedWsId) {
      setForm(null);
      return;
    }

    const existing = configs.find((c) => c.workspace_id === selectedWsId);
    if (existing) {
      setForm({ ...existing });
    } else {
      setForm({
        workspace_id: selectedWsId,
        ...EMPTY_CONFIG,
      });
    }
    setError(null);
    setSuccess(null);
  }, [selectedWsId, configs]);

  function updateField(field: keyof Config, value: string | boolean) {
    if (!form) return;
    setForm({ ...form, [field]: value });
  }

  async function handleSave() {
    if (!form) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/workspace-clicksign-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao salvar");
        return;
      }
      setSuccess("Configuração salva com sucesso");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-mute)] uppercase tracking-wide">
        Assinatura por empresa
      </h2>

      {/* Workspace selector */}
      <select
        value={selectedWsId}
        onChange={(e) => setSelectedWsId(e.target.value)}
        className="etax-input w-full min-h-[48px]"
      >
        <option value="">Selecione uma empresa</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.nome_fantasia || w.nome}
            {configuredIds.has(w.id) ? " ✓" : ""}
          </option>
        ))}
      </select>

      {/* Status summary */}
      {workspaces.length > 0 && (
        <p className="text-xs text-[var(--color-text-mute)]">
          {configuredIds.size} de {workspaces.length} empresas configuradas
        </p>
      )}

      {/* Config form */}
      {form && selectedWs && (
        <div className="etax-card space-y-4">
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            {selectedWs.nome_fantasia || selectedWs.nome}
          </h3>

          {/* Token ClickSign */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
              Token ClickSign
            </label>
            <input
              type="password"
              value={form.clicksign_token}
              onChange={(e) => updateField("clicksign_token", e.target.value)}
              className="etax-input w-full min-h-[48px] font-mono text-xs"
              placeholder="Token da API ClickSign para esta empresa"
            />
          </div>

          {/* Parte Contratada */}
          <fieldset className="border border-[var(--color-line)] rounded-[var(--radius-card)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-[var(--color-text-mute)] uppercase px-1">
              Parte Contratada
            </legend>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Nome
              </label>
              <input
                type="text"
                value={form.contratada_nome}
                onChange={(e) => updateField("contratada_nome", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="Nome completo de quem assina pela empresa"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.contratada_email}
                onChange={(e) => updateField("contratada_email", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="email@empresa.com"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={form.contratada_auto}
                onChange={(e) => updateField("contratada_auto", e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                Assinatura automática
              </span>
            </label>
            {form.contratada_auto && (
              <p className="text-xs text-[var(--color-status-warn)] bg-[var(--color-status-warn-bg)] rounded-[var(--radius-btn)] p-2">
                Requer Termo de Assinatura Automática previamente assinado na ClickSign.
              </p>
            )}
          </fieldset>

          {/* Testemunha 1 */}
          <fieldset className="border border-[var(--color-line)] rounded-[var(--radius-card)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-[var(--color-text-mute)] uppercase px-1">
              Testemunha 1
            </legend>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Nome
              </label>
              <input
                type="text"
                value={form.testemunha1_nome}
                onChange={(e) => updateField("testemunha1_nome", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.testemunha1_email}
                onChange={(e) => updateField("testemunha1_email", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="email@testemunha.com"
              />
            </div>
          </fieldset>

          {/* Testemunha 2 */}
          <fieldset className="border border-[var(--color-line)] rounded-[var(--radius-card)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-[var(--color-text-mute)] uppercase px-1">
              Testemunha 2
            </legend>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                Nome
              </label>
              <input
                type="text"
                value={form.testemunha2_nome}
                onChange={(e) => updateField("testemunha2_nome", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.testemunha2_email}
                onChange={(e) => updateField("testemunha2_email", e.target.value)}
                className="etax-input w-full min-h-[48px]"
                placeholder="email@testemunha.com"
              />
            </div>
          </fieldset>

          {/* Error / Success */}
          {error && (
            <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-ok)] bg-[var(--color-status-ok-bg)] p-3 text-sm text-[var(--color-status-ok)]">
              {success}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="etax-btn etax-btn-primary w-full min-h-[48px]"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Salvando...
              </>
            ) : (
              "Salvar configuração"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
