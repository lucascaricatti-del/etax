import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const sessao = await getSessao();
  if (!sessao?.isEtax) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { nome, cnpj } = body;

  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    return NextResponse.json(
      { error: "Nome da empresa é obrigatório (mín. 2 caracteres)" },
      { status: 400 }
    );
  }

  const slug = slugify(nome.trim());
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("workspaces")
    .insert({ nome: nome.trim(), cnpj: cnpj || null, slug, ativo: true })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erro ao criar empresa: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
