import { createAdminClient } from "@/lib/supabase/admin";
import type { Sessao } from "@/lib/auth";

/**
 * Query builder centralizado para contratos.
 * Garante escopo por workspace (Etax vê tudo, cliente vê o seu)
 * e campos consistentes em todas as telas.
 */

const CONTRATO_SELECT_FULL =
  "id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim, assinado_em, criado_em, pdf_assinado_path, workspace_id, natureza_documento, conta_no_dashboard, contrato_pai_id, data_distrato, valor_distrato, inadimplente_em, valor_inadimplencia, excluido_em, modelo_id, contraparte:contrapartes(nome, cpf_cnpj), workspace:workspaces(id, nome, nome_fantasia), modelo:modelos(id, nome, natureza_financeira)";

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
  // Sanitiza o termo: remove caracteres com significado no filtro PostgREST
  // (vírgula, parênteses, aspas) para evitar injeção de filtro no .or()
  const term = busca?.trim().replace(/[,()"']/g, "") ?? "";
  if (term) {
    let contrapartesQuery = supabase
      .from("contrapartes")
      .select("id")
      .or(`nome.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`);
    // Escopo por workspace: cliente só busca contrapartes do próprio workspace
    contrapartesQuery = applyWorkspaceScope(contrapartesQuery, sessao);
    const { data: matchingContrapartes } = await contrapartesQuery;
    contraparteIds = matchingContrapartes?.map((c) => c.id) ?? [];
    if (contraparteIds.length === 0) {
      return { data: [], error: null, count: 0 };
    }
  }

  let query = supabase
    .from("contratos")
    .select(CONTRATO_SELECT_FULL, { count: "exact" });

  query = applyWorkspaceScope(query, sessao);

  // Exclude soft-deleted e rascunhos (geração em andamento/falha parcial)
  query = query.is("excluido_em", null).neq("status_assinatura", "rascunho");

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
    scopedCount().not("status_assinatura", "in", "(recusado,expirado,rascunho)"),
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
        .neq("status_assinatura", "rascunho")
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

/**
 * Snapshot da inadimplência ATUAL (estado corrente, não é por período).
 * Contratos assinados marcados como inadimplentes, mesma regra de inclusão
 * do dashboard. Valor em risco = COALESCE(valor_inadimplencia, valor).
 * Inadimplência NÃO desconta da receita — é indicador de risco separado.
 */
async function fetchInadimplenciaAtual(
  sessao: Sessao,
  opts?: { workspaceId?: string; tipo?: string }
) {
  const supabase = createAdminClient();

  let q = supabase
    .from("contratos")
    .select("id, valor, valor_inadimplencia, inadimplente_em")
    .eq("status_assinatura", "assinado")
    .not("inadimplente_em", "is", null)
    .eq("natureza_documento", "principal")
    .eq("conta_no_dashboard", true)
    .is("excluido_em", null);

  q = applyWorkspaceScope(q, sessao);
  if (opts?.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
  if (opts?.tipo) q = q.eq("tipo", opts.tipo);

  const { data } = await q;
  const rows = data ?? [];
  const valorEmRisco = rows.reduce(
    (sum, r) => sum + (r.valor_inadimplencia ?? r.valor ?? 0),
    0
  );
  return { qtd: rows.length, valorEmRisco };
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
    .lte(
      "data_distrato",
      `${mesStr}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
    );

  if (!sessao.isEtax) {
    qAssinados = applyWorkspaceScope(qAssinados, sessao);
    qDistratados = applyWorkspaceScope(qDistratados, sessao);
  }

  if (filters?.workspaceId) {
    qAssinados = qAssinados.eq("workspace_id", filters.workspaceId);
    qDistratados = qDistratados.eq("workspace_id", filters.workspaceId);
  }

  const [resAssinados, resDistratados, inadimplencia] = await Promise.all([
    qAssinados,
    qDistratados,
    fetchInadimplenciaAtual(sessao, { workspaceId: filters?.workspaceId }),
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
    inadimplencia,
  };
}

/**
 * Visão financeira por PERÍODO (intervalo de meses) — usada em /financeiro (cliente).
 * Mesma regra de inclusão do dashboard financeiro:
 * assinado + principal + conta_no_dashboard + excluido_em IS NULL.
 * Churn por data_distrato dentro do período.
 * Agrega totais, série mensal e breakdown por tipo de contrato.
 */
export interface FinanceiroPeriodoFilters {
  de?: string; // "YYYY-MM" — default: 5 meses antes de `ate` (janela de 6 meses)
  ate?: string; // "YYYY-MM" — default: mês atual
  tipo?: string; // filtra por tipo de contrato
}

export interface FinanceiroMes {
  mes: string; // "YYYY-MM"
  receita: number;
  despesa: number;
  churn: number;
  liquida: number; // receita - churn
  qtdAssinados: number;
}

export interface ContratoPeriodo {
  id: string;
  tipo: string;
  valor: number | null;
  assinado_em: string | null;
  data_distrato: string | null;
  valor_distrato: number | null;
  natureza_financeira: string;
  contraparte_nome: string;
}

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchFinanceiroPeriodo(
  sessao: Sessao,
  filters?: FinanceiroPeriodoFilters
) {
  const supabase = createAdminClient();

  const now = new Date();
  let ateStr = filters?.ate || mesKey(now);
  let deStr = filters?.de || "";
  if (!deStr) {
    const [ay, am] = ateStr.split("-").map(Number);
    deStr = mesKey(new Date(ay, am - 1 - 5, 1));
  }
  if (deStr > ateStr) {
    const tmp = deStr;
    deStr = ateStr;
    ateStr = tmp;
  }

  const [dy, dm] = deStr.split("-").map(Number);
  const [ay, am] = ateStr.split("-").map(Number);
  const periodoStart = new Date(dy, dm - 1, 1).toISOString();
  const periodoEnd = new Date(ay, am, 0, 23, 59, 59, 999).toISOString();
  const distratoStart = `${deStr}-01`;
  const distratoEnd = `${ateStr}-${String(new Date(ay, am, 0).getDate()).padStart(2, "0")}`;

  const selectFields =
    "id, tipo, valor, assinado_em, data_distrato, valor_distrato, modelo:modelos(natureza_financeira), contraparte:contrapartes(nome)";

  let qAssinados = supabase
    .from("contratos")
    .select(selectFields)
    .eq("status_assinatura", "assinado")
    .eq("natureza_documento", "principal")
    .eq("conta_no_dashboard", true)
    .is("excluido_em", null)
    .gte("assinado_em", periodoStart)
    .lte("assinado_em", periodoEnd)
    .order("assinado_em", { ascending: false });

  let qDistratados = supabase
    .from("contratos")
    .select(selectFields)
    .eq("status_assinatura", "distratado")
    .eq("natureza_documento", "principal")
    .eq("conta_no_dashboard", true)
    .is("excluido_em", null)
    .gte("data_distrato", distratoStart)
    .lte("data_distrato", distratoEnd)
    .order("data_distrato", { ascending: false });

  qAssinados = applyWorkspaceScope(qAssinados, sessao);
  qDistratados = applyWorkspaceScope(qDistratados, sessao);

  if (filters?.tipo) {
    qAssinados = qAssinados.eq("tipo", filters.tipo);
    qDistratados = qDistratados.eq("tipo", filters.tipo);
  }

  const [resAssinados, resDistratados, inadimplencia] = await Promise.all([
    qAssinados,
    qDistratados,
    fetchInadimplenciaAtual(sessao, { tipo: filters?.tipo }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRow(row: any): ContratoPeriodo {
    const modelo = row.modelo as { natureza_financeira: string } | null;
    const contraparte = row.contraparte as { nome: string } | null;
    return {
      id: row.id,
      tipo: row.tipo,
      valor: row.valor,
      assinado_em: row.assinado_em,
      data_distrato: row.data_distrato,
      valor_distrato: row.valor_distrato,
      natureza_financeira: modelo?.natureza_financeira ?? "receita",
      contraparte_nome: contraparte?.nome ?? "—",
    };
  }

  const assinados = (resAssinados.data ?? []).map(mapRow);
  const distratados = (resDistratados.data ?? []).map(mapRow);

  const receitas = assinados.filter((c) => c.natureza_financeira === "receita");
  const despesas = assinados.filter((c) => c.natureza_financeira === "despesa");

  const receitaBruta = receitas.reduce((sum, c) => sum + (c.valor ?? 0), 0);
  const churn = distratados.reduce((sum, c) => sum + (c.valor_distrato ?? 0), 0);
  const receitaLiquida = receitaBruta - churn;
  const despesaTotal = despesas.reduce((sum, c) => sum + (c.valor ?? 0), 0);
  const ticketMedio = receitas.length > 0 ? receitaBruta / receitas.length : 0;

  // Série mensal: um bucket por mês do período
  const mesesMap = new Map<string, FinanceiroMes>();
  const cursor = new Date(dy, dm - 1, 1);
  const fim = new Date(ay, am - 1, 1);
  while (cursor <= fim) {
    const key = mesKey(cursor);
    mesesMap.set(key, {
      mes: key,
      receita: 0,
      despesa: 0,
      churn: 0,
      liquida: 0,
      qtdAssinados: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const c of assinados) {
    if (!c.assinado_em) continue;
    const bucket = mesesMap.get(mesKey(new Date(c.assinado_em)));
    if (!bucket) continue;
    if (c.natureza_financeira === "despesa") {
      bucket.despesa += c.valor ?? 0;
    } else {
      bucket.receita += c.valor ?? 0;
      bucket.qtdAssinados += 1;
    }
  }
  for (const c of distratados) {
    if (!c.data_distrato) continue;
    // data_distrato é DATE ("YYYY-MM-DD") — extrai o mês direto da string
    const bucket = mesesMap.get(c.data_distrato.slice(0, 7));
    if (!bucket) continue;
    bucket.churn += c.valor_distrato ?? 0;
  }
  for (const m of mesesMap.values()) {
    m.liquida = m.receita - m.churn;
  }
  const meses = Array.from(mesesMap.values());

  // Breakdown por tipo (só receitas)
  const tipoMap = new Map<string, { tipo: string; qtd: number; total: number }>();
  for (const c of receitas) {
    const key = c.tipo || "—";
    if (!tipoMap.has(key)) {
      tipoMap.set(key, { tipo: key, qtd: 0, total: 0 });
    }
    const t = tipoMap.get(key)!;
    t.qtd += 1;
    t.total += c.valor ?? 0;
  }
  const porTipo = Array.from(tipoMap.values()).sort((a, b) => b.total - a.total);

  return {
    de: deStr,
    ate: ateStr,
    receitaBruta,
    churn,
    receitaLiquida,
    despesaTotal,
    ticketMedio,
    qtdAssinados: receitas.length,
    qtdDistratos: distratados.length,
    meses,
    porTipo,
    assinados,
    distratados,
    inadimplencia,
  };
}
