import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function GET() {
  const sessao = await getSessao();
  if (!sessao?.isEtax) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Contratos assinados: valor, assinado_em, modelo_id
  const { data: assinados } = await supabase
    .from("contratos")
    .select("id, tipo, valor, status_assinatura, assinado_em, modelo_id, natureza_documento, conta_no_dashboard")
    .eq("status_assinatura", "assinado")
    .is("excluido_em", null);

  // Mês atual
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return NextResponse.json({
    mes_filtro_dashboard: mesAtual,
    total_assinados: assinados?.length ?? 0,
    contratos: assinados?.map(c => ({
      id: c.id.slice(0, 8),
      tipo: c.tipo,
      valor: c.valor,
      assinado_em: c.assinado_em,
      modelo_id: c.modelo_id,
      natureza_documento: c.natureza_documento,
      conta_no_dashboard: c.conta_no_dashboard,
    })),
  });
}
