import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function GET() {
  const sessao = await getSessao();
  if (!sessao?.isEtax) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Test 1: query simples sem joins novos
  const test1 = await supabase
    .from("contratos")
    .select("id, tipo, status_assinatura, workspace_id")
    .limit(3);

  // Test 2: query com colunas novas
  const test2 = await supabase
    .from("contratos")
    .select("id, natureza_documento, conta_no_dashboard, excluido_em, modelo_id")
    .limit(3);

  // Test 3: query com join modelo
  const test3 = await supabase
    .from("contratos")
    .select("id, modelo:modelos(id, nome)")
    .limit(3);

  // Test 4: query com filtro excluido_em IS NULL
  const test4 = await supabase
    .from("contratos")
    .select("id, tipo", { count: "exact" })
    .is("excluido_em", null);

  // Test 5: query completa (a que roda no /contratos)
  const test5 = await supabase
    .from("contratos")
    .select("id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim, assinado_em, criado_em, pdf_assinado_path, workspace_id, natureza_documento, conta_no_dashboard, contrato_pai_id, data_distrato, valor_distrato, excluido_em, modelo_id, contraparte:contrapartes(nome, cpf_cnpj), workspace:workspaces(id, nome, nome_fantasia), modelo:modelos(id, nome, natureza_financeira)")
    .is("excluido_em", null)
    .order("criado_em", { ascending: false })
    .limit(3);

  return NextResponse.json({
    test1_simples: { data: test1.data?.length, error: test1.error?.message },
    test2_colunas_novas: { data: test2.data?.length, error: test2.error?.message },
    test3_join_modelo: { data: test3.data?.length, error: test3.error?.message },
    test4_filtro_excluido: { count: test4.count, error: test4.error?.message },
    test5_query_completa: { data: test5.data?.length, error: test5.error?.message },
  });
}
