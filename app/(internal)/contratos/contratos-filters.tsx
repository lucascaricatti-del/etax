"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { FilterBar } from "@/components/filter-bar";
import { SegmentedControl } from "@/components/segmented-control";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "aguardando_assinatura", label: "Aguardando assinatura" },
  { value: "assinado", label: "Assinado" },
  { value: "distratado", label: "Distratado" },
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

  const hasFilters = !!(
    searchParams.get("busca") ||
    searchParams.get("empresa") ||
    searchParams.get("tipo") ||
    searchParams.get("status") ||
    searchParams.get("mes")
  );

  function clearFilters() {
    const params = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) params.set("view", view);
    router.push(`/contratos?${params.toString()}`);
    if (searchRef.current) searchRef.current.value = "";
  }

  const mesValue = searchParams.get("mes") ?? "";
  const currentView = searchParams.get("view") || "lista";

  return (
    <div className="space-y-3 mb-4">
      <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
        {/* Search */}
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar contraparte / CNPJ..."
          defaultValue={searchParams.get("busca") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          className="etax-filter-select w-full sm:w-auto sm:min-w-[220px]"
        />

        {isEtax && (
          <select
            value={searchParams.get("empresa") ?? ""}
            onChange={(e) => handleChange("empresa", e.target.value)}
            className="etax-filter-select w-full sm:w-auto"
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
          className="etax-filter-select w-full sm:w-auto"
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
          className="etax-filter-select w-full sm:w-auto"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Month input with placeholder fix */}
        <div className="relative w-full sm:w-auto">
          <input
            type="month"
            value={mesValue}
            onChange={(e) => handleChange("mes", e.target.value)}
            className="etax-filter-select w-full sm:w-auto min-w-[140px]"
          />
          {!mesValue && (
            <span className="absolute inset-0 flex items-center px-2 text-[0.8125rem] text-[var(--color-text-mute)] pointer-events-none bg-[var(--color-card)] rounded-[var(--radius-btn)] border border-[var(--color-line)]">
              Período
            </span>
          )}
        </div>
      </FilterBar>

      {isEtax && (
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={[
              { value: "lista", label: "Lista" },
              { value: "agrupado", label: "Por cliente" },
            ]}
            value={currentView}
            onChange={(v) => handleChange("view", v === "lista" ? "" : v)}
          />
        </div>
      )}
    </div>
  );
}
