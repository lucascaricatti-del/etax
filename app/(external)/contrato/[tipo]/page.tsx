import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoContrato } from "@/lib/types";
import { ContratoForm } from "./contrato-form";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo: slug } = await params;
  const supabase = createAdminClient();

  const { data: tipo } = await supabase
    .from("tipos_contrato")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();

  if (!tipo) {
    notFound();
  }

  const tipoContrato = tipo as TipoContrato;

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">
        Solicitação de Contrato — {tipoContrato.nome}
      </h1>
      <p className="text-gray-600 mb-8">
        Preencha os dados abaixo para solicitar a confecção do contrato.
      </p>
      <ContratoForm tipoContrato={tipoContrato} />
    </>
  );
}
