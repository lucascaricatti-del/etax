"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NovaEmpresaForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cnpj: cnpj || null }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erro ao criar empresa");
      setLoading(false);
      return;
    }

    setNome("");
    setCnpj("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="etax-btn etax-btn-primary"
      >
        Nova empresa
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="etax-card space-y-4"
    >
      <h2 className="etax-section-label">Nova empresa</h2>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          Nome <span className="text-[var(--color-status-danger)]">*</span>
        </label>
        <input
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da empresa"
          className="etax-input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          CNPJ
        </label>
        <input
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="00.000.000/0000-00 (opcional)"
          className="etax-input"
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="etax-btn etax-btn-primary"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="etax-btn etax-btn-ghost"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
