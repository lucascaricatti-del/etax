import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Acesso restrito à Etax" },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const tipoContratoId = searchParams.get("tipo_contrato_id");
    const workspaceId = searchParams.get("workspace_id");
    const listAll = searchParams.get("all") === "1";

    const supabase = createAdminClient();

    // List all for /modelos management page
    if (listAll) {
      const { data, error } = await supabase
        .from("modelos")
        .select("*, tipo_contrato:tipos_contrato(id, nome, slug), modelo_empresas(workspace_id)")
        .order("criado_em", { ascending: false });

      if (error) {
        console.error("[Modelos] Erro ao listar:", error);
        return NextResponse.json({ error: "Erro ao listar modelos" }, { status: 500 });
      }
      return NextResponse.json(data ?? []);
    }

    // Filter for confecção: active models for a specific tipo_contrato + workspace availability
    let query = supabase
      .from("modelos")
      .select("id, nome, descricao, versao, tipo_contrato_id, workspace_id, ativo, clicksign_template_key, natureza_financeira, disponibilidade, modelo_empresas(workspace_id)")
      .eq("ativo", true)
      .order("versao", { ascending: false });

    if (tipoContratoId) {
      query = query.eq("tipo_contrato_id", tipoContratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Modelos] Erro ao listar:", error);
      return NextResponse.json({ error: "Erro ao listar modelos" }, { status: 500 });
    }

    // Filter by workspace availability
    let filtered = data ?? [];
    if (workspaceId) {
      filtered = filtered.filter((m) => {
        if (m.disponibilidade === "todas") return true;
        const vinculos = (m.modelo_empresas ?? []) as { workspace_id: string }[];
        return vinculos.some((v) => v.workspace_id === workspaceId);
      });
    }

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[Modelos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json({ error: "Acesso restrito à Etax" }, { status: 403 });
    }

    const body = await request.json();
    const {
      nome,
      descricao,
      tipo_contrato_id,
      clicksign_template_key,
      natureza_financeira,
      disponibilidade,
      variaveis,
      schema_campos,
      ativo,
      workspace_ids,
    } = body;

    if (!nome || !tipo_contrato_id || !clicksign_template_key) {
      return NextResponse.json(
        { error: "nome, tipo_contrato_id e clicksign_template_key são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get next version for this tipo_contrato
    const { data: existing } = await supabase
      .from("modelos")
      .select("versao")
      .eq("tipo_contrato_id", tipo_contrato_id)
      .order("versao", { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.versao ?? 0) + 1;

    const { data: modelo, error } = await supabase
      .from("modelos")
      .insert({
        nome,
        descricao: descricao || null,
        tipo_contrato_id,
        clicksign_template_key,
        natureza_financeira: natureza_financeira || "neutro",
        disponibilidade: disponibilidade || "todas",
        variaveis: variaveis || [],
        schema_campos: schema_campos || null,
        versao: nextVersion,
        ativo: ativo ?? true,
      })
      .select("id")
      .single();

    if (error || !modelo) {
      console.error("[Modelos] Erro ao criar:", error);
      return NextResponse.json({ error: error?.message || "Erro ao criar modelo" }, { status: 500 });
    }

    // Insert workspace links if disponibilidade = especificas
    if (disponibilidade === "especificas" && workspace_ids?.length > 0) {
      const links = workspace_ids.map((wsId: string) => ({
        modelo_id: modelo.id,
        workspace_id: wsId,
      }));
      const { error: errLinks } = await supabase.from("modelo_empresas").insert(links);
      if (errLinks) {
        console.error("[Modelos] Erro ao vincular empresas:", errLinks);
      }
    }

    return NextResponse.json({ id: modelo.id }, { status: 201 });
  } catch (err) {
    console.error("[Modelos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
