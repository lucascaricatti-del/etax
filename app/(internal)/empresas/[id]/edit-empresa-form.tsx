"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export function EditEmpresaForm({
  workspace,
  isAdmin,
}: {
  workspace: {
    id: string;
    nome: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    ativo: boolean;
  };
  isAdmin: boolean;
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

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    setDeleting(true);
    setError("");

    const res = await fetch(`/api/empresas/${workspace.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erro ao excluir");
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }

    router.push("/empresas");
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-line)]">
        <button
          onClick={() => setEditing(true)}
          className="etax-btn etax-btn-secondary min-h-[40px] text-sm"
        >
          <Pencil size={14} />
          Editar dados
        </button>

        {isAdmin && (
          <>
            {!confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="etax-btn etax-btn-danger min-h-[40px] text-sm"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
                <Tooltip text="Desativa a empresa. Contratos ativos impedem a exclusão." />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="etax-btn etax-btn-danger min-h-[40px] text-sm"
                >
                  {deleting ? "Excluindo..." : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="etax-btn etax-btn-ghost min-h-[40px] text-sm"
                >
                  Cancelar
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <span className="text-xs text-[var(--color-status-danger)]">
            {error}
          </span>
        )}
      </div>
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
