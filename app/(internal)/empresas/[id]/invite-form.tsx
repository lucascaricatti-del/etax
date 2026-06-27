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

  const inputClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className={inputClass}
          />
        </div>
        <div className="w-36">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Papel
          </label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            className={inputClass}
          >
            <option value="membro">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Convidar"}
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800 mb-1">
            Convite criado! Copie o link abaixo:
          </p>
          <input
            type="text"
            readOnly
            value={inviteLink}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full rounded border border-green-300 bg-white px-2 py-1 text-xs font-mono"
          />
        </div>
      )}
    </div>
  );
}
