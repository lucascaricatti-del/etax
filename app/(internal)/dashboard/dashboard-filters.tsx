"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";

export function DashboardFilters({
  workspaces,
  isEtax,
}: {
  workspaces: Array<{ id: string; nome: string; nome_fantasia: string | null }>;
  isEtax: boolean;
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
    router.push(`/dashboard?${params.toString()}`);
  }

  const mesValue = searchParams.get("mes") ?? "";
  const hasFilters = !!(mesValue || searchParams.get("empresa"));

  function clearFilters() {
    router.push("/dashboard");
  }

  return (
    <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
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

      {isEtax && workspaces.length > 0 && (
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
    </FilterBar>
  );
}
