import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  return (
    <div className="flex h-full">
      <Sidebar
        userName={sessao.profile?.nome ?? sessao.user.email ?? "Usuário"}
        isEtax={sessao.isEtax}
      />
      <main className="flex-1 ml-[var(--sidebar-width)] bg-[var(--color-bg)] min-h-screen">
        <div className="px-8 py-8 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
