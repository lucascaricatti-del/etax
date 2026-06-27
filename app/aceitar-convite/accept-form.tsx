"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Call API to create account + accept invite
    const res = await fetch("/api/aceitar-convite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, nome }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erro ao aceitar convite");
      setLoading(false);
      return;
    }

    // 2. Sign in with the new credentials
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Conta criada, mas erro ao fazer login: " + signInError.message);
      setLoading(false);
      return;
    }

    // Hard redirect — ensures cookies are sent fresh to the server
    window.location.href = "/solicitacoes";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="etax-input bg-[var(--color-bg)] text-[var(--color-text-mute)]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          Seu nome
        </label>
        <input
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          className="etax-input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-soft)] mb-1">
          Senha
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="etax-input"
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-btn)] border border-[var(--color-status-danger)] bg-[var(--color-status-danger-bg)] p-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="etax-btn etax-btn-primary w-full py-2.5"
      >
        {loading ? "Criando conta..." : "Criar conta e acessar"}
      </button>
    </form>
  );
}
