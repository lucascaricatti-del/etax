import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";

export default async function RootPage() {
  const sessao = await getSessao();

  if (!sessao) {
    redirect("/login");
  }

  if (sessao.isEtax) {
    redirect("/dashboard");
  }

  redirect("/dashboard");
}
