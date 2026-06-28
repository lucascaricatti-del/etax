"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditEmpresaForm({
  workspace,
}: {
  workspace: {
    id: string;
    nome: string;
    nome_fantasia: string | null;
    cnpj: string | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(workspace.nome);
  const [nomeFantasia, setNomeFantasia] = useState(
    workspace.nome_fantasia ?? ""
  );
  const [cnpj, setCnpj] = useState(workspace.cnpj ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!nome.trim()) {
      setError("Razão social é obrigatória");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch(`/api/empresas/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nome.trim(),
        nome_fantasia: nomeFantasia.trim() || null,
        cnpj: cnpj.trim() || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erro ao salvar");
      setLoading(false);
      return;
    }

    setEditing(false);
    setLoading(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-[var(--color-primary)] hover:underline mt-2"
      >
        Editar dados
      </button>
    );
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-[var(--color-line)]">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
          Razão Social
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="etax-input min-h-[48px]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
          Nome Fantasia
        </label>
        <input
          type="text"
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          className="etax-input min-h-[48px]"
          placeholder="Nome fantasia (exibido nas telas)"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-mute)] uppercase mb-1">
          CNPJ
        </label>
        <input
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          className="etax-input min-h-[48px]"
          placeholder="00.000.000/0000-00"
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="etax-btn etax-btn-primary min-h-[48px]"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setNome(workspace.nome);
            setNomeFantasia(workspace.nome_fantasia ?? "");
            setCnpj(workspace.cnpj ?? "");
            setError("");
          }}
          className="etax-btn etax-btn-ghost min-h-[48px]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
