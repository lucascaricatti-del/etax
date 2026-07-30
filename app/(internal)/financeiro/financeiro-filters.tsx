"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Atalhos de período — calculam o par de/até */
function presetRange(preset: string): { de: string; ate: string } | null {
  const now = new Date();
  const ate = mesKey(now);
  switch (preset) {
    case "mes":
      return { de: ate, ate };
    case "3m":
      return { de: mesKey(new Date(now.getFullYear(), now.getMonth() - 2, 1)), ate };
    case "6m":
      return { de: mesKey(new Date(now.getFullYear(), now.getMonth() - 5, 1)), ate };
    case "12m":
      return { de: mesKey(new Date(now.getFullYear(), now.getMonth() - 11, 1)), ate };
    case "ano":
      return { de: `${now.getFullYear()}-01`, ate };
    default:
      return null;
  }
}

const PRESETS = [
  { value: "mes", label: "Este mês" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "Este ano" },
];

export function FinanceiroFilters({
  de,
  ate,
  tipos,
}: {
  de: string; // período efetivo (já resolvido no server)
  ate: string;
  tipos: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function push(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/financeiro?${qs}` : "/financeiro");
  }

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    push(params);
  }

  function handlePreset(preset: string) {
    if (!preset) return;
    const range = presetRange(preset);
    if (!range) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("de", range.de);
    params.set("ate", range.ate);
    push(params);
  }

  // Preset ativo (quando de/até batem exatamente com um atalho)
  const activePreset =
    PRESETS.find((p) => {
      const r = presetRange(p.value);
      return r && r.de === de && r.ate === ate;
    })?.value ?? "";

  const tipoValue = searchParams.get("tipo") ?? "";
  const hasFilters = !!(
    searchParams.get("de") ||
    searchParams.get("ate") ||
    tipoValue
  );

  // Opções de mês: mês atual + 23 anteriores
  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    monthOptions.push({
      value: mesKey(d),
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  // Garante que os valores efetivos aparecem nas opções
  for (const v of [de, ate]) {
    if (!monthOptions.some((m) => m.value === v)) {
      const [y, m] = v.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      monthOptions.push({
        value: v,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
  }
  monthOptions.sort((a, b) => (a.value < b.value ? 1 : -1));

  return (
    <FilterBar hasActiveFilters={hasFilters} onClear={() => router.push("/financeiro")}>
      <select
        value={activePreset}
        onChange={(e) => handlePreset(e.target.value)}
        className="etax-filter-select w-full sm:w-auto"
      >
        <option value="">Atalhos de período</option>
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        value={de}
        onChange={(e) => handleChange("de", e.target.value)}
        className="etax-filter-select w-full sm:w-auto"
        aria-label="De"
      >
        {monthOptions.map((m) => (
          <option key={m.value} value={m.value}>
            De: {m.label}
          </option>
        ))}
      </select>

      <select
        value={ate}
        onChange={(e) => handleChange("ate", e.target.value)}
        className="etax-filter-select w-full sm:w-auto"
        aria-label="Até"
      >
        {monthOptions.map((m) => (
          <option key={m.value} value={m.value}>
            Até: {m.label}
          </option>
        ))}
      </select>

      {tipos.length > 0 && (
        <select
          value={tipoValue}
          onChange={(e) => handleChange("tipo", e.target.value)}
          className="etax-filter-select w-full sm:w-auto capitalize"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </select>
      )}
    </FilterBar>
  );
}
