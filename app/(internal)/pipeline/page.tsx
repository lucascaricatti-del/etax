import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/lib/format";

// Kanban do cliente — pipeline em 3 colunas:
// 1. Solicitação feita (em andamento na Etax)
// 2. Aguardando assinatura (contrato na ClickSign)
// 3. Assinado (status do CONTRATO — a solicitação congela em
//    "enviada_assinatura" por design; o estágio final vive no contrato)

const SOLICITACAO_EM_ANDAMENTO = [
  "nova",
  "em_confeccao",
  "aguardando_aprovacao",
  "aprovada",
  "gerando",
];

interface CardData {
  id: string;
  href: string;
  nome: string;
  tipo: string;
  valor: number | null;
  data: string;
  dataLabel: string;
  status: string;
  inadimplente?: boolean;
}

export default async function PipelinePage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  // Etax acompanha pelo console (Confecção / Assinaturas / Contratos)
  if (sessao.isEtax) redirect("/dashboard");
  if (sessao.workspaceIds.length === 0) redirect("/dashboard");

  const supabase = createAdminClient();
  const ids = sessao.workspaceIds;

  const [solResult, contratosResult] = await Promise.all([
    supabase
      .from("solicitacoes")
      .select(
        "id, status, criado_em, dados, contraparte:contrapartes(nome), tipo_contrato:tipos_contrato(nome)"
      )
      .in("workspace_id", ids)
      .in("status", SOLICITACAO_EM_ANDAMENTO)
      .order("criado_em", { ascending: false }),
    supabase
      .from("contratos")
      .select(
        "id, tipo, valor, status_assinatura, criado_em, assinado_em, inadimplente_em, contraparte:contrapartes(nome)"
      )
      .in("workspace_id", ids)
      .in("status_assinatura", ["aguardando_assinatura", "assinado"])
      .is("excluido_em", null)
      .order("criado_em", { ascending: false })
      .limit(200),
  ]);

  const solicitacoes = solResult.data ?? [];
  const contratos = contratosResult.data ?? [];

  const colSolicitacoes: CardData[] = solicitacoes.map((s) => {
    const contraparte = s.contraparte as unknown as { nome: string } | null;
    const tipoContrato = s.tipo_contrato as unknown as { nome: string } | null;
    const dados = s.dados as Record<string, unknown> | null;
    const valorRaw = dados?.valor_total;
    const valor =
      typeof valorRaw === "number"
        ? valorRaw
        : typeof valorRaw === "string" && valorRaw !== "" && !isNaN(Number(valorRaw))
          ? Number(valorRaw)
          : null;
    return {
      id: s.id,
      href: `/solicitacoes/${s.id}`,
      nome: contraparte?.nome ?? "—",
      tipo: tipoContrato?.nome ?? "—",
      valor,
      data: s.criado_em,
      dataLabel: "Criada em",
      status: s.status,
    };
  });

  const colAguardando: CardData[] = [];
  const colAssinados: CardData[] = [];

  for (const c of contratos) {
    const contraparte = c.contraparte as unknown as { nome: string } | null;
    const card: CardData = {
      id: c.id,
      href: `/contratos/${c.id}`,
      nome: contraparte?.nome ?? "—",
      tipo: c.tipo,
      valor: c.valor,
      data:
        c.status_assinatura === "assinado" && c.assinado_em
          ? c.assinado_em
          : c.criado_em,
      dataLabel:
        c.status_assinatura === "assinado" ? "Assinado em" : "Enviado em",
      status: c.status_assinatura,
      inadimplente:
        !!c.inadimplente_em && c.status_assinatura === "assinado",
    };
    if (c.status_assinatura === "assinado") {
      colAssinados.push(card);
    } else {
      colAguardando.push(card);
    }
  }

  const columns = [
    {
      key: "solicitacao",
      title: "Solicitação feita",
      accent: "var(--color-status-info)",
      cards: colSolicitacoes,
      empty: "Nenhuma solicitação em andamento",
    },
    {
      key: "aguardando",
      title: "Aguardando assinatura",
      accent: "var(--color-status-warn)",
      cards: colAguardando,
      empty: "Nenhum contrato aguardando assinatura",
    },
    {
      key: "assinado",
      title: "Assinado",
      accent: "var(--color-status-ok)",
      cards: colAssinados,
      empty: "Nenhum contrato assinado",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Pipeline
        </h1>
        <p className="text-sm text-[var(--color-text-mute)] mt-1">
          Acompanhe seus contratos da solicitação até a assinatura
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {columns.map((col) => (
          <section key={col.key}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: col.accent }}
              />
              <h2 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
                {col.title}
              </h2>
              <span className="text-xs font-medium text-[var(--color-text-mute)]">
                ({col.cards.length})
              </span>
            </div>

            <div
              className="space-y-2 rounded-[var(--radius-card)] bg-[var(--color-card)] border border-[var(--color-line)] p-3 min-h-[90px]"
              style={{ borderTop: `3px solid ${col.accent}` }}
            >
              {col.cards.length === 0 ? (
                <p className="text-xs text-[var(--color-text-mute)] text-center py-6">
                  {col.empty}
                </p>
              ) : (
                col.cards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="block rounded-[var(--radius-btn)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3 hover:ring-2 hover:ring-[var(--color-primary)] transition-shadow active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                        {card.nome}
                      </p>
                      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <StatusBadge status={card.status} />
                        {card.inadimplente && (
                          <StatusBadge status="inadimplente" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-xs text-[var(--color-text-soft)]">
                      <div className="flex justify-between gap-2">
                        <span className="capitalize truncate">{card.tipo}</span>
                        {card.valor != null && (
                          <span className="font-medium text-[var(--color-text)] flex-shrink-0">
                            {formatBRL(card.valor)}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--color-text-mute)]">
                        {card.dataLabel}{" "}
                        {new Date(card.data).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
