import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { ImportarContratoForm } from "./importar-form";

export default async function ImportarContratoPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  if (!sessao.isAdmin) redirect("/contratos");

  const supabase = createAdminClient();

  const [{ data: workspaces }, { data: tipos }, { data: modelos }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("id, nome, nome_fantasia")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("tipos_contrato")
        .select("id, nome, slug")
        .order("nome"),
      supabase
        .from("modelos")
        .select("id, nome, versao, tipo_contrato_id, workspace_id, natureza_financeira")
        .eq("ativo", true)
        .order("nome"),
    ]);

  return (
    <div>
      <Link
        href="/contratos"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4"
      >
        &larr; Voltar para contratos
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Importar contrato antigo
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-mute)]">
          Anexe o PDF de um contrato já assinado fora do sistema. A IA lê o
          documento e preenche os dados — você revisa antes de salvar.
        </p>
      </div>

      <ImportarContratoForm
        workspaces={workspaces ?? []}
        tipos={tipos ?? []}
        modelos={modelos ?? []}
      />
    </div>
  );
}
