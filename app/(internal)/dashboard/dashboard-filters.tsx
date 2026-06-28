"use client";

import { useRouter, useSearchParams } from "next/navigation";

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

  return (
    <div className="flex gap-2 flex-wrap mb-6">
      <input
        type="month"
        value={searchParams.get("mes") ?? ""}
        onChange={(e) => handleChange("mes", e.target.value)}
        className="etax-input w-full sm:w-auto min-h-[48px]"
      />

      {isEtax && workspaces.length > 0 && (
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
    </div>
  );
}
