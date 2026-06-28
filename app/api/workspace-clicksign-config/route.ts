import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

/** GET /api/workspace-clicksign-config?workspace_id=... — fetch config for a workspace */
export async function GET(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a admin Etax" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    const supabase = createAdminClient();

    if (workspaceId) {
      const { data, error } = await supabase
        .from("workspace_clicksign_config")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // List all configs with workspace name
    const { data, error } = await supabase
      .from("workspace_clicksign_config")
      .select("*, workspace:workspaces(id, nome, nome_fantasia)")
      .order("criado_em", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[GET /api/workspace-clicksign-config]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Validate CPF format: must have exactly 11 digits */
function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11;
}

/** POST /api/workspace-clicksign-config — create or update config */
export async function POST(request: Request) {
  try {
    const sessao = await getSessao();
    if (!sessao?.isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a admin Etax" }, { status: 403 });
    }

    const body = await request.json();
    const {
      workspace_id,
      clicksign_token,
      contratada_nome,
      contratada_email,
      contratada_cpf,
      contratada_auto,
      testemunha1_nome,
      testemunha1_email,
      testemunha1_cpf,
      testemunha2_nome,
      testemunha2_email,
      testemunha2_cpf,
    } = body;

    if (!workspace_id || !clicksign_token?.trim()) {
      return NextResponse.json(
        { error: "workspace_id e clicksign_token são obrigatórios" },
        { status: 400 }
      );
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = [
      { field: "contratada_email", value: contratada_email },
      { field: "testemunha1_email", value: testemunha1_email },
      { field: "testemunha2_email", value: testemunha2_email },
    ];
    for (const { field, value } of emails) {
      if (!value?.trim() || !emailRegex.test(value.trim())) {
        return NextResponse.json(
          { error: `E-mail inválido: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate names
    const names = [
      { field: "contratada_nome", value: contratada_nome },
      { field: "testemunha1_nome", value: testemunha1_nome },
      { field: "testemunha2_nome", value: testemunha2_nome },
    ];
    for (const { field, value } of names) {
      if (!value?.trim()) {
        return NextResponse.json(
          { error: `Nome obrigatório: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate CPFs
    const cpfs = [
      { label: "Contratada", value: contratada_cpf },
      { label: "Testemunha 1", value: testemunha1_cpf },
      { label: "Testemunha 2", value: testemunha2_cpf },
    ];
    for (const { label, value } of cpfs) {
      if (!value?.trim() || !isValidCpf(value)) {
        return NextResponse.json(
          { error: `CPF inválido ou ausente: ${label}. Informe os 11 dígitos.` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    const payload = {
      workspace_id,
      clicksign_token: clicksign_token.trim(),
      contratada_nome: contratada_nome.trim(),
      contratada_email: contratada_email.trim(),
      contratada_cpf: contratada_cpf.trim(),
      contratada_auto: !!contratada_auto,
      testemunha1_nome: testemunha1_nome.trim(),
      testemunha1_email: testemunha1_email.trim(),
      testemunha1_cpf: testemunha1_cpf.trim(),
      testemunha2_nome: testemunha2_nome.trim(),
      testemunha2_email: testemunha2_email.trim(),
      testemunha2_cpf: testemunha2_cpf.trim(),
      atualizado_em: new Date().toISOString(),
    };

    // Upsert by workspace_id
    const { data, error } = await supabase
      .from("workspace_clicksign_config")
      .upsert(payload, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/workspace-clicksign-config]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[POST /api/workspace-clicksign-config]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
