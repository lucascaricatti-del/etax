import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";
import { hardDeleteContrato } from "@/lib/hard-delete";

/**
 * PATCH /api/contratos/[id]
 *
 * Admin-only actions on a contrato:
 * - action: "toggle_dashboard" → flip conta_no_dashboard
 * - action: "marcar_aditivo" → set natureza_documento='aditivo', link contrato_pai_id
 * - action: "registrar_distrato" → set status_assinatura='distratado', data_distrato, valor_distrato
 * - action: "editar_distrato" → corrige data_distrato/valor_distrato de um distratado
 * - action: "desfazer_distrato" → reverte distrato (volta a assinado, limpa campos)
 * - action: "marcar_inadimplente" → inadimplente_em + valor_inadimplencia/observação (opcionais)
 * - action: "regularizar_inadimplencia" → limpa os campos de inadimplência
 * - action: "excluir" → soft delete (excluido_em + excluido_por)
 * - action: "restaurar" → undo soft delete
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json(
        { error: "Apenas admin Etax pode executar esta ação" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const supabase = createAdminClient();

    // Verify contrato exists
    const { data: contrato, error: errFetch } = await supabase
      .from("contratos")
      .select("id, status_assinatura, natureza_documento, conta_no_dashboard, excluido_em, inadimplente_em")
      .eq("id", id)
      .single();

    if (errFetch || !contrato) {
      return NextResponse.json(
        { error: "Contrato não encontrado" },
        { status: 404 }
      );
    }

    switch (action) {
      case "toggle_dashboard": {
        const { error } = await supabase
          .from("contratos")
          .update({ conta_no_dashboard: !contrato.conta_no_dashboard })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: `Contrato ${!contrato.conta_no_dashboard ? "incluído no" : "excluído do"} dashboard`,
          conta_no_dashboard: !contrato.conta_no_dashboard,
        });
      }

      case "marcar_aditivo": {
        const { contrato_pai_id } = body;
        if (!contrato_pai_id) {
          return NextResponse.json(
            { error: "contrato_pai_id é obrigatório" },
            { status: 400 }
          );
        }

        // Verify parent exists
        const { data: pai } = await supabase
          .from("contratos")
          .select("id")
          .eq("id", contrato_pai_id)
          .single();

        if (!pai) {
          return NextResponse.json(
            { error: "Contrato pai não encontrado" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            natureza_documento: "aditivo",
            contrato_pai_id,
            conta_no_dashboard: false,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Contrato marcado como aditivo",
        });
      }

      case "registrar_distrato": {
        const { data_distrato, valor_distrato } = body;
        if (!data_distrato || valor_distrato == null) {
          return NextResponse.json(
            { error: "data_distrato e valor_distrato são obrigatórios" },
            { status: 400 }
          );
        }

        if (contrato.status_assinatura !== "assinado") {
          return NextResponse.json(
            { error: "Só contratos assinados podem ser distratados" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            status_assinatura: "distratado",
            data_distrato,
            valor_distrato: Number(valor_distrato),
            // Distrato encerra a inadimplência — o valor vira churn definitivo
            inadimplente_em: null,
            valor_inadimplencia: null,
            inadimplencia_observacao: null,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Distrato registrado",
        });
      }

      case "editar_distrato": {
        const { data_distrato, valor_distrato } = body;
        if (!data_distrato || valor_distrato == null) {
          return NextResponse.json(
            { error: "data_distrato e valor_distrato são obrigatórios" },
            { status: 400 }
          );
        }

        if (contrato.status_assinatura !== "distratado") {
          return NextResponse.json(
            { error: "Só contratos distratados podem ter o distrato editado" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            data_distrato,
            valor_distrato: Number(valor_distrato),
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Distrato atualizado",
        });
      }

      case "desfazer_distrato": {
        if (contrato.status_assinatura !== "distratado") {
          return NextResponse.json(
            { error: "Contrato não está distratado" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            status_assinatura: "assinado",
            data_distrato: null,
            valor_distrato: null,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Distrato desfeito — contrato voltou a assinado",
        });
      }

      case "marcar_inadimplente": {
        const { inadimplente_em, valor_inadimplencia, inadimplencia_observacao } = body;
        if (!inadimplente_em) {
          return NextResponse.json(
            { error: "inadimplente_em (data) é obrigatório" },
            { status: 400 }
          );
        }

        if (contrato.status_assinatura !== "assinado") {
          return NextResponse.json(
            { error: "Só contratos assinados podem ser marcados como inadimplentes" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            inadimplente_em,
            valor_inadimplencia:
              valor_inadimplencia != null && valor_inadimplencia !== ""
                ? Number(valor_inadimplencia)
                : null,
            inadimplencia_observacao: inadimplencia_observacao || null,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Contrato marcado como inadimplente",
        });
      }

      case "regularizar_inadimplencia": {
        if (!contrato.inadimplente_em) {
          return NextResponse.json(
            { error: "Contrato não está marcado como inadimplente" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            inadimplente_em: null,
            valor_inadimplencia: null,
            inadimplencia_observacao: null,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Inadimplência regularizada",
        });
      }

      case "excluir": {
        if (contrato.excluido_em) {
          return NextResponse.json(
            { error: "Contrato já excluído" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            excluido_em: new Date().toISOString(),
            excluido_por: sessao.user.id,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Contrato excluído (soft delete)",
        });
      }

      case "restaurar": {
        if (!contrato.excluido_em) {
          return NextResponse.json(
            { error: "Contrato não está excluído" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("contratos")
          .update({
            excluido_em: null,
            excluido_por: null,
          })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          message: "Contrato restaurado",
        });
      }

      default:
        return NextResponse.json(
          { error: `Ação desconhecida: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[PATCH /api/contratos/[id]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/contratos/[id] — exclusão DEFINITIVA (admin Etax).
 * Apaga: eventos_assinatura, PDF do storage, o contrato e a solicitação vinculada.
 * Irreversível — usado para limpar contratos de teste.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json(
        { error: "Apenas admin Etax pode excluir definitivamente" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: contrato, error: errFetch } = await supabase
      .from("contratos")
      .select("id, pdf_assinado_path, solicitacao_id")
      .eq("id", id)
      .single();

    if (errFetch || !contrato) {
      return NextResponse.json(
        { error: "Contrato não encontrado" },
        { status: 404 }
      );
    }

    await hardDeleteContrato(supabase, contrato);

    // Apagar a solicitação vinculada (o contrato já foi removido; falha aqui não desfaz)
    if (contrato.solicitacao_id) {
      const { error: errSol } = await supabase
        .from("solicitacoes")
        .delete()
        .eq("id", contrato.solicitacao_id);

      if (errSol) {
        console.error(
          "[DELETE /api/contratos/[id]] Contrato apagado, mas falhou ao apagar solicitação vinculada:",
          errSol
        );
        return NextResponse.json({
          message:
            "Contrato excluído definitivamente, mas a solicitação vinculada não pôde ser apagada",
        });
      }
    }

    return NextResponse.json({
      message: "Contrato excluído definitivamente",
    });
  } catch (err) {
    console.error("[DELETE /api/contratos/[id]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/contratos/[id] — fetch single contrato with details */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("contratos")
      .select(
        `id, tipo, valor, status_assinatura, status_vigencia, vigencia_inicio, vigencia_fim,
         assinado_em, criado_em, pdf_assinado_path, workspace_id, natureza_documento,
         contrato_pai_id, conta_no_dashboard, data_distrato, valor_distrato,
         excluido_em, excluido_por, modelo_id, clicksign_envelope_id,
         contraparte:contrapartes(id, nome, cpf_cnpj),
         workspace:workspaces(id, nome, nome_fantasia),
         modelo:modelos(id, nome, natureza_financeira, versao)`
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Contrato não encontrado" },
        { status: 404 }
      );
    }

    // Scope check: cliente só acessa se workspace_id não-nulo E pertencer a ele
    if (!sessao.isEtax) {
      if (!data.workspace_id || !sessao.workspaceIds.includes(data.workspace_id)) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/contratos/[id]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
