"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("membro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInviteLink("");

    const res = await fetch(`/api/empresas/${workspaceId}/convites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, papel }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.error || "Erro ao criar convite");
      setLoading(false);
      return;
    }

    setInviteLink(body.link);
    setEmail("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="etax-input"
          />
        </div>
        <div className="w-36">
          <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
            Papel
          </label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            className="etax-input"
          >
            <option value="membro">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="etax-btn etax-btn-primary"
        >
          {loading ? "Enviando..." : "Convidar"}
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="mt-3 rounded-[var(--radius-btn)] border border-[var(--color-status-ok)] bg-[var(--color-status-ok-bg)] p-3">
          <p className="text-sm font-medium text-[var(--color-status-ok)] mb-1">
            Convite criado! Copie o link abaixo:
          </p>
          <input
            type="text"
            readOnly
            value={inviteLink}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-card)] px-2 py-1 text-xs font-mono"
          />
        </div>
      )}
    </div>
  );
}
