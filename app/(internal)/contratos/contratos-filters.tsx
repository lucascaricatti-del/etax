"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "aguardando_assinatura", label: "Aguardando assinatura" },
  { value: "assinado", label: "Assinado" },
  { value: "recusado", label: "Recusado" },
  { value: "expirado", label: "Expirado" },
];

export function ContratosFilters({
  workspaces,
  tipos,
  isEtax,
}: {
  workspaces: Array<{ id: string; nome: string; nome_fantasia: string | null }>;
  tipos: string[];
  isEtax: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when filter changes
    if (key !== "page") {
      params.delete("page");
    }
    router.push(`/contratos?${params.toString()}`);
  }

  function handleSearch() {
    const value = searchRef.current?.value ?? "";
    handleChange("busca", value);
  }

  const hasFilters = searchParams.get("busca") || searchParams.get("empresa") ||
    searchParams.get("tipo") || searchParams.get("status") || searchParams.get("mes");

  function clearFilters() {
    const params = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) params.set("view", view);
    router.push(`/contratos?${params.toString()}`);
    if (searchRef.current) searchRef.current.value = "";
  }

  return (
    <div className="space-y-3 mb-4">
      <div className="flex gap-2 flex-wrap">
        {/* Search */}
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar contraparte / CNPJ..."
          defaultValue={searchParams.get("busca") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          className="etax-input w-full sm:w-auto sm:min-w-[220px] min-h-[48px]"
        />

        {isEtax && (
          <select
            value={searchParams.get("empresa") ?? ""}
            onChange={(e) => handleChange("empresa", e.target.value)}
            className="etax-input w-full sm:w-auto min-h-[48px]"
          >
            <option value="">Todas as empresas</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nome_fantasia || w.nome}
              </option>
            ))}
          </select>
        )}

        <select
          value={searchParams.get("tipo") ?? ""}
          onChange={(e) => handleChange("tipo", e.target.value)}
          className="etax-input w-full sm:w-auto min-h-[48px]"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => handleChange("status", e.target.value)}
          className="etax-input w-full sm:w-auto min-h-[48px]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={searchParams.get("mes") ?? ""}
          onChange={(e) => handleChange("mes", e.target.value)}
          className="etax-input w-full sm:w-auto min-h-[48px]"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {isEtax && (
          <div className="flex gap-1 rounded-[var(--radius-btn)] border border-[var(--color-line)] overflow-hidden">
            <button
              onClick={() => handleChange("view", "")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors min-h-[40px] ${
                !searchParams.get("view") || searchParams.get("view") === "lista"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-bg)] text-[var(--color-text-soft)] hover:bg-[var(--color-card)]"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => handleChange("view", "agrupado")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors min-h-[40px] ${
                searchParams.get("view") === "agrupado"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-bg)] text-[var(--color-text-soft)] hover:bg-[var(--color-card)]"
              }`}
            >
              Por cliente
            </button>
          </div>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[var(--color-primary)] hover:underline min-h-[40px] px-2"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
