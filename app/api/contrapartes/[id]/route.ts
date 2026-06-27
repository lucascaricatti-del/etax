import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!sessao.isEtax) {
      return NextResponse.json(
        { error: "Apenas a Etax pode editar contrapartes" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { nome, cpf_cnpj, email, telefone } = body;

    const update: Record<string, unknown> = {};

    if (nome != null) {
      const trimmed = String(nome).trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Nome não pode ser vazio" },
          { status: 400 }
        );
      }
      update.nome = trimmed;
    }

    if (cpf_cnpj !== undefined) {
      if (cpf_cnpj) {
        const digits = String(cpf_cnpj).replace(/\D/g, "");
        if (digits.length !== 11 && digits.length !== 14) {
          return NextResponse.json(
            { error: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos" },
            { status: 400 }
          );
        }
        update.cpf_cnpj = digits;
        update.tipo_pessoa = digits.length === 14 ? "PJ" : "PF";
      } else {
        update.cpf_cnpj = null;
      }
    }

    if (email !== undefined) {
      if (email) {
        const trimmed = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return NextResponse.json(
            { error: "E-mail inválido" },
            { status: 400 }
          );
        }
        update.email = trimmed;
      } else {
        update.email = null;
      }
    }

    if (telefone !== undefined) {
      if (telefone) {
        const digits = String(telefone).replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
          return NextResponse.json(
            { error: "Telefone inválido" },
            { status: 400 }
          );
        }
        update.telefone = digits;
      } else {
        update.telefone = null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error: errUpdate } = await supabase
      .from("contrapartes")
      .update(update)
      .eq("id", id);

    if (errUpdate) {
      console.error("[PATCH contraparte] Erro:", errUpdate);
      return NextResponse.json(
        { error: "Erro ao atualizar contraparte: " + errUpdate.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Contraparte atualizada" });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
