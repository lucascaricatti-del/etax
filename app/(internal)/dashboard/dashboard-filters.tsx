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

  // Generate month options (current month + 11 previous months)
  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    monthOptions.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  return (
    <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
      <select
        value={mesValue}
        onChange={(e) => handleChange("mes", e.target.value)}
        className="etax-filter-select w-full sm:w-auto"
      >
        <option value="">Período</option>
        {monthOptions.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

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
