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

  const inputClass =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          disabled
          className={`${inputClass} bg-gray-50 text-gray-500`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Seu nome
        </label>
        <input
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Senha
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className={inputClass}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Criando conta..." : "Criar conta e acessar"}
      </button>
    </form>
  );
}
