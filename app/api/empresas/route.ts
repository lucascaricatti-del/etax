import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

async function uniqueSlug(supabase: ReturnType<typeof createAdminClient>, base: string): Promise<string> {
  const { count } = await supabase
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("slug", base);

  if (!count) return base;

  // Append incrementing suffix until unique
  let attempt = 2;
  while (true) {
    const candidate = `${base}-${attempt}`;
    const { count: c } = await supabase
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (!c) return candidate;
    attempt++;
  }
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

  const supabase = createAdminClient();
  const slug = await uniqueSlug(supabase, slugify(nome.trim()));

  const { data, error } = await supabase
    .from("workspaces")
    .insert({ nome: nome.trim(), cnpj: cnpj || null, slug, ativo: true })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe uma empresa com esse nome ou CNPJ." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao criar empresa: " + error.message },
      { status: 500 }
    );
  }

  revalidatePath("/empresas");

  return NextResponse.json({ id: data.id }, { status: 201 });
}
