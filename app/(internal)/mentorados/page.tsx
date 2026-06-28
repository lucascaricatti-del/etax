import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";

export default async function MentoradosPage() {
  const sessao = await getSessao();
  if (!sessao?.isEtax) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
        Mentorados
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-mute)]">
        Visão por contraparte
      </p>
    </div>
  );
}
