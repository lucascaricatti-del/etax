import { createAdminClient } from "@/lib/supabase/admin";
import type { Sessao } from "@/lib/auth";

/**
 * Query builder centralizado para contratos.
 * Garante escopo por workspace (Etax vê tudo, cliente vê o seu)
 * e campos consistentes em todas as telas.
 */

const CONTRATO_SELECT_FULL =
  "id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim, assinado_em, criado_em, pdf_assinado_path, workspace_id, contraparte:contrapartes(nome, cpf_cnpj)";

const CONTRATO_SELECT_COMPACT =
  "id, tipo, valor, status_assinatura, criado_em, assinado_em, contraparte:contrapartes(nome)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWorkspaceScope(query: any, sessao: Sessao) {
  if (sessao.isEtax) return query;
  if (sessao.workspaceIds.length === 0) {
    return query.eq("workspace_id", "00000000-0000-0000-0000-000000000000");
  }
  if (sessao.workspaceIds.length === 1) {
    return query.eq("workspace_id", sessao.workspaceIds[0]);
  }
  return query.in("workspace_id", sessao.workspaceIds);
}

/** Todos os contratos (para /contratos) */
export async function fetchContratos(sessao: Sessao) {
  const supabase = createAdminClient();
  let query = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL)
    .order("criado_em", { ascending: false });

  query = applyWorkspaceScope(query, sessao);

  const { data, error } = await query;

  console.log("[fetchContratos]", { count: data?.length ?? 0, error: error?.message ?? null });
  return { data, error };
}

/** Contratos por status de assinatura (para /assinaturas) */
export async function fetchContratosPorAssinatura(sessao: Sessao) {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let qPendentes = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL)
    .eq("status_assinatura", "aguardando_assinatura")
    .order("criado_em", { ascending: true });

  let qFinalizados = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL)
    .in("status_assinatura", ["assinado", "recusado", "expirado"])
    .gte("criado_em", thirtyDaysAgo.toISOString())
    .order("criado_em", { ascending: false })
    .limit(50);

  qPendentes = applyWorkspaceScope(qPendentes, sessao) as typeof qPendentes;
  qFinalizados = applyWorkspaceScope(qFinalizados, sessao) as typeof qFinalizados;

  const [pendentes, finalizados] = await Promise.all([qPendentes, qFinalizados]);

  console.log("[fetchContratosPorAssinatura]", {
    pendentes: pendentes.data?.length ?? 0,
    pendentes_error: pendentes.error?.message ?? null,
    finalizados: finalizados.data?.length ?? 0,
    finalizados_error: finalizados.error?.message ?? null,
  });

  return { pendentes, finalizados };
}

/** KPIs agregados para o dashboard */
export async function fetchDashboardData(sessao: Sessao) {
  const supabase = createAdminClient();
  const isEtax = sessao.isEtax;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  function scopedCount() {
    let q = supabase.from("contratos").select("id", { count: "exact", head: true });
    if (!isEtax) q = applyWorkspaceScope(q, sessao);
    return q;
  }

  const [
    totalAtivos,
    aguardandoAssinatura,
    assinadosMes,
    aVencer30,
    aguardandoAprovacao,
    recentes,
    vencimentos,
  ] = await Promise.all([
    scopedCount().not("status_assinatura", "in", "(recusado,expirado)"),
    scopedCount().eq("status_assinatura", "aguardando_assinatura"),
    scopedCount().eq("status_assinatura", "assinado").gte("assinado_em", startOfMonth),
    scopedCount()
      .not("vigencia_fim", "is", null)
      .lte("vigencia_fim", thirtyDaysFromNow.toISOString())
      .gte("vigencia_fim", now.toISOString()),
    isEtax
      ? supabase
          .from("solicitacoes")
          .select("id", { count: "exact", head: true })
          .eq("status", "aguardando_aprovacao")
      : Promise.resolve({ count: 0, error: null }),
    (() => {
      let q = supabase
        .from("contratos")
        .select(CONTRATO_SELECT_COMPACT)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (!isEtax) q = applyWorkspaceScope(q, sessao);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("contratos")
        .select("id, tipo, vigencia_fim, contraparte:contrapartes(nome)")
        .not("vigencia_fim", "is", null)
        .lte("vigencia_fim", thirtyDaysFromNow.toISOString())
        .gte("vigencia_fim", now.toISOString())
        .order("vigencia_fim", { ascending: true })
        .limit(5);
      if (!isEtax) q = applyWorkspaceScope(q, sessao);
      return q;
    })(),
  ]);

  console.log("[fetchDashboardData]", {
    totalAtivos: totalAtivos.count,
    aguardandoAssinatura: aguardandoAssinatura.count,
    assinadosMes: assinadosMes.count,
    aVencer30: aVencer30.count,
    aguardandoAprovacao: aguardandoAprovacao.count,
    recentes: recentes.data?.length ?? 0,
    recentes_error: recentes.error?.message ?? null,
    vencimentos: vencimentos.data?.length ?? 0,
  });

  return {
    totalAtivos: totalAtivos.count ?? 0,
    aguardandoAssinatura: aguardandoAssinatura.count ?? 0,
    assinadosMes: assinadosMes.count ?? 0,
    aVencer30: aVencer30.count ?? 0,
    aguardandoAprovacao: aguardandoAprovacao.count ?? 0,
    recentes: recentes.data ?? [],
    vencimentos: vencimentos.data ?? [],
  };
}
