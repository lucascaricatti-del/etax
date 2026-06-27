import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Aceitar convite — Etax Ops" };

export default async function AceitarConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-2">Link inválido</h1>
          <p className="text-gray-600">Token de convite não fornecido.</p>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("id, email, role, accepted, expires_at, workspace:workspaces(id, nome)")
    .eq("token", token)
    .single();

  if (!invite) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-2">Convite não encontrado</h1>
          <p className="text-gray-600">
            Este link de convite é inválido ou já foi utilizado.
          </p>
        </div>
      </div>
    );
  }

  if (invite.accepted) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-2">Convite já aceito</h1>
          <p className="text-gray-600">
            Este convite já foi utilizado. Faça login para acessar o sistema.
          </p>
        </div>
      </div>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-2">Convite expirado</h1>
          <p className="text-gray-600">
            Este convite expirou. Solicite um novo convite ao administrador.
          </p>
        </div>
      </div>
    );
  }

  const workspace = invite.workspace as unknown as { id: string; nome: string } | null;

  return (
    <div className="flex items-center justify-center min-h-full bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Etax Ops</h1>
          <p className="text-sm text-gray-600 mt-1">
            Você foi convidado para <strong>{workspace?.nome}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Crie sua senha para acessar o sistema.
          </p>
        </div>
        <AcceptForm token={token} email={invite.email} />
      </div>
    </div>
  );
}
