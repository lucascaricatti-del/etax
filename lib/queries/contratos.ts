import { createAdminClient } from "@/lib/supabase/admin";
import type { Sessao } from "@/lib/auth";

/**
 * Query builder centralizado para contratos.
 * Garante escopo por workspace (Etax vê tudo, cliente vê o seu)
 * e campos consistentes em todas as telas.
 */

const CONTRATO_SELECT_FULL =
  "id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim, assinado_em, criado_em, pdf_assinado_path, workspace_id, natureza_documento, conta_no_dashboard, contrato_pai_id, data_distrato, valor_distrato, excluido_em, modelo_id, contraparte:contrapartes(nome, cpf_cnpj), workspace:workspaces(id, nome, nome_fantasia), modelo:modelos(id, nome, natureza_financeira)";

const CONTRATO_SELECT_COMPACT =
  "id, tipo, valor, status_assinatura, criado_em, assinado_em, workspace_id, natureza_documento, conta_no_dashboard, excluido_em, modelo_id, contraparte:contrapartes(nome), workspace:workspaces(id, nome, nome_fantasia), modelo:modelos(id, nome, natureza_financeira)";

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

/** Filtros opcionais para a listagem de contratos */
export interface ContratoFilters {
  workspaceId?: string;
  tipo?: string;
  statusAssinatura?: string;
  mes?: string; // "YYYY-MM"
  busca?: string; // busca por contraparte nome/cpf_cnpj
  page?: number;
  pageSize?: number;
}

/** Todos os contratos com filtros e paginação (para /contratos) */
export async function fetchContratos(
  sessao: Sessao,
  filters?: ContratoFilters
) {
  const supabase = createAdminClient();
  const {
    workspaceId,
    tipo,
    statusAssinatura,
    mes,
    busca,
    page = 1,
    pageSize = 20,
  } = filters ?? {};

  // If there's a text search, find matching contraparte IDs first
  let contraparteIds: string[] | null = null;
  if (busca && busca.trim()) {
    const term = busca.trim();
    const { data: matchingContrapartes } = await supabase
      .from("contrapartes")
      .select("id")
      .or(`nome.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`);
    contraparteIds = matchingContrapartes?.map((c) => c.id) ?? [];
    if (contraparteIds.length === 0) {
      return { data: [], error: null, count: 0 };
    }
  }

  let query = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL, { count: "exact" });

  query = applyWorkspaceScope(query, sessao);

  // Exclude soft-deleted
  query = query.is("excluido_em", null);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  if (statusAssinatura) {
    query = query.eq("status_assinatura", statusAssinatura);
  }

  if (mes) {
    const [year, month] = mes.split("-").map(Number);
    if (year && month) {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      query = query.gte("criado_em", start).lte("criado_em", end);
    }
  }

  if (contraparteIds) {
    query = query.in("contraparte_id", contraparteIds);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order("criado_em", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  return { data, error, count };
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
    .is("excluido_em", null)
    .order("criado_em", { ascending: true });

  let qFinalizados = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL)
    .in("status_assinatura", ["assinado", "recusado", "expirado"])
    .is("excluido_em", null)
    .gte("criado_em", thirtyDaysAgo.toISOString())
    .order("criado_em", { ascending: false })
    .limit(50);

  qPendentes = applyWorkspaceScope(qPendentes, sessao) as typeof qPendentes;
  qFinalizados = applyWorkspaceScope(qFinalizados, sessao) as typeof qFinalizados;

  const [pendentes, finalizados] = await Promise.all([qPendentes, qFinalizados]);

  return { pendentes, finalizados };
}

/** KPIs operacionais + dados para o dashboard */
export async function fetchDashboardData(sessao: Sessao) {
  const supabase = createAdminClient();
  const isEtax = sessao.isEtax;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  function scopedCount() {
    let q = supabase
      .from("contratos")
      .select("id", { count: "exact", head: true })
      .is("excluido_em", null);
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
        .is("excluido_em", null)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (!isEtax) q = applyWorkspaceScope(q, sessao);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("contratos")
        .select("id, tipo, vigencia_fim, contraparte:contrapartes(nome), workspace:workspaces(id, nome, nome_fantasia)")
        .is("excluido_em", null)
        .not("vigencia_fim", "is", null)
        .lte("vigencia_fim", thirtyDaysFromNow.toISOString())
        .gte("vigencia_fim", now.toISOString())
        .order("vigencia_fim", { ascending: true })
        .limit(5);
      if (!isEtax) q = applyWorkspaceScope(q, sessao);
      return q;
    })(),
  ]);

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

/**
 * Dados financeiros para o dashboard.
 * Regra de inclusão: status_assinatura='assinado', natureza_documento='principal',
 * conta_no_dashboard=true, excluido_em IS NULL.
 * Churn: status_assinatura='distratado', mesma regra de principal + dashboard.
 *
 * Retorna dados brutos — a agregação (group by workspace, mês) é feita em JS.
 */
export interface DashboardFinanceiroFilters {
  mes?: string; // "YYYY-MM" — se omitido, pega o mês atual
  workspaceId?: string;
}

export interface ContratoFinanceiro {
  id: string;
  valor: number | null;
  workspace_id: string | null;
  assinado_em: string | null;
  data_distrato: string | null;
  valor_distrato: number | null;
  status_assinatura: string;
  natureza_financeira: string; // from modelo
  workspace_nome: string;
  workspace_nome_fantasia: string | null;
}

export async function fetchDashboardFinanceiro(
  sessao: Sessao,
  filters?: DashboardFinanceiroFilters
) {
  const supabase = createAdminClient();

  const now = new Date();
  const mesStr = filters?.mes || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = mesStr.split("-").map(Number);
  const mesStart = new Date(year, month - 1, 1).toISOString();
  const mesEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  const selectFields =
    "id, valor, workspace_id, assinado_em, data_distrato, valor_distrato, status_assinatura, modelo:modelos(natureza_financeira), workspace:workspaces(nome, nome_fantasia)";

  // Query 1: Contratos assinados no mês (receita + despesa)
  let qAssinados = supabase
    .from("contratos")
    .select(selectFields)
    .eq("status_assinatura", "assinado")
    .eq("natureza_documento", "principal")
    .eq("conta_no_dashboard", true)
    .is("excluido_em", null)
    .gte("assinado_em", mesStart)
    .lte("assinado_em", mesEnd);

  // Query 2: Distratados no mês (churn)
  let qDistratados = supabase
    .from("contratos")
    .select(selectFields)
    .eq("status_assinatura", "distratado")
    .eq("natureza_documento", "principal")
    .eq("conta_no_dashboard", true)
    .is("excluido_em", null)
    .gte("data_distrato", mesStr + "-01")
    .lte("data_distrato", mesStr + "-31");

  if (!sessao.isEtax) {
    qAssinados = applyWorkspaceScope(qAssinados, sessao);
    qDistratados = applyWorkspaceScope(qDistratados, sessao);
  }

  if (filters?.workspaceId) {
    qAssinados = qAssinados.eq("workspace_id", filters.workspaceId);
    qDistratados = qDistratados.eq("workspace_id", filters.workspaceId);
  }

  const [resAssinados, resDistratados] = await Promise.all([
    qAssinados,
    qDistratados,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRow(row: any): ContratoFinanceiro {
    const modelo = row.modelo as { natureza_financeira: string } | null;
    const ws = row.workspace as { nome: string; nome_fantasia: string | null } | null;
    return {
      id: row.id,
      valor: row.valor,
      workspace_id: row.workspace_id,
      assinado_em: row.assinado_em,
      data_distrato: row.data_distrato,
      valor_distrato: row.valor_distrato,
      status_assinatura: row.status_assinatura,
      natureza_financeira: modelo?.natureza_financeira ?? "receita",
      workspace_nome: ws?.nome ?? "Sem empresa",
      workspace_nome_fantasia: ws?.nome_fantasia ?? null,
    };
  }

  const assinados = (resAssinados.data ?? []).map(mapRow);
  const distratados = (resDistratados.data ?? []).map(mapRow);

  // Aggregate
  const receitas = assinados.filter((c) => c.natureza_financeira === "receita");
  const despesas = assinados.filter((c) => c.natureza_financeira === "despesa");

  const receitaBruta = receitas.reduce((sum, c) => sum + (c.valor ?? 0), 0);
  const churn = distratados.reduce((sum, c) => sum + (c.valor_distrato ?? 0), 0);
  const receitaLiquida = receitaBruta - churn;
  const despesaTotal = despesas.reduce((sum, c) => sum + (c.valor ?? 0), 0);

  // Per-workspace breakdown
  const wsMap = new Map<
    string,
    {
      workspaceId: string;
      displayName: string;
      receita: number;
      despesa: number;
      churn: number;
    }
  >();

  function ensureWs(c: ContratoFinanceiro) {
    const wsId = c.workspace_id ?? "sem-empresa";
    if (!wsMap.has(wsId)) {
      wsMap.set(wsId, {
        workspaceId: wsId,
        displayName: c.workspace_nome_fantasia || c.workspace_nome,
        receita: 0,
        despesa: 0,
        churn: 0,
      });
    }
    return wsMap.get(wsId)!;
  }

  for (const c of receitas) {
    ensureWs(c).receita += c.valor ?? 0;
  }
  for (const c of despesas) {
    ensureWs(c).despesa += c.valor ?? 0;
  }
  for (const c of distratados) {
    ensureWs(c).churn += c.valor_distrato ?? 0;
  }

  const porEmpresa = Array.from(wsMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return {
    mes: mesStr,
    receitaBruta,
    churn,
    receitaLiquida,
    despesaTotal,
    porEmpresa,
    assinados,
    distratados,
  };
}
