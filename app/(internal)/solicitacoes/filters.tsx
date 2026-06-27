"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "nova", label: "Nova" },
  { value: "em_confeccao", label: "Em confecção" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovada", label: "Aprovada" },
  { value: "enviada_assinatura", label: "Enviada p/ assinatura" },
  { value: "cancelada", label: "Cancelada" },
];

export function Filters({
  tipos,
  tipoAtual,
  statusAtual,
  isEtax,
  workspaces,
  empresaAtual,
}: {
  tipos: Array<{ id: string; nome: string }>;
  tipoAtual?: string;
  statusAtual?: string;
  isEtax: boolean;
  workspaces: Array<{ id: string; nome: string }>;
  empresaAtual?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/solicitacoes?${params.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <div className="flex gap-3 flex-wrap">
      {isEtax && (
        <select
          value={empresaAtual ?? ""}
          onChange={(e) => handleChange("empresa", e.target.value)}
          className={selectClass}
        >
          <option value="">Todas as empresas</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nome}
            </option>
          ))}
        </select>
      )}

      <select
        value={tipoAtual ?? ""}
        onChange={(e) => handleChange("tipo", e.target.value)}
        className={selectClass}
      >
        <option value="">Todos os tipos</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>

      <select
        value={statusAtual ?? ""}
        onChange={(e) => handleChange("status", e.target.value)}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
