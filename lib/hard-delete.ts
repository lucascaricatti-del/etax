import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ContratoParaExclusao {
  id: string;
  pdf_assinado_path: string | null;
  solicitacao_id: string | null;
}

/**
 * Hard delete de um contrato (irreversível):
 * 1. Desvincula aditivos filhos (contrato_pai_id → null)
 * 2. Apaga eventos_assinatura do contrato
 * 3. Apaga o PDF assinado do storage (best-effort, não bloqueia)
 * 4. Apaga o registro de contratos
 *
 * NÃO apaga a solicitação vinculada — responsabilidade do caller.
 * Lança Error em falha de banco.
 */
export async function hardDeleteContrato(
  supabase: AdminClient,
  contrato: ContratoParaExclusao
): Promise<void> {
  // 1. Desvincular aditivos filhos
  const { error: errFilhos } = await supabase
    .from("contratos")
    .update({ contrato_pai_id: null })
    .eq("contrato_pai_id", contrato.id);

  if (errFilhos) {
    throw new Error("Erro ao desvincular aditivos: " + errFilhos.message);
  }

  // 2. Apagar eventos de assinatura
  const { error: errEventos } = await supabase
    .from("eventos_assinatura")
    .delete()
    .eq("contrato_id", contrato.id);

  if (errEventos) {
    throw new Error(
      "Erro ao apagar eventos de assinatura: " + errEventos.message
    );
  }

  // 3. Apagar PDF do storage (best-effort)
  if (contrato.pdf_assinado_path) {
    const { error: errStorage } = await supabase.storage
      .from("contratos-assinados")
      .remove([contrato.pdf_assinado_path]);

    if (errStorage) {
      console.error(
        "[hardDeleteContrato] Falha ao apagar PDF do storage (seguindo mesmo assim):",
        errStorage
      );
    }
  }

  // 4. Apagar o contrato
  const { error: errDelete } = await supabase
    .from("contratos")
    .delete()
    .eq("id", contrato.id);

  if (errDelete) {
    throw new Error("Erro ao apagar contrato: " + errDelete.message);
  }
}
