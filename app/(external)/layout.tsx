import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Etax — Contrato",
  description: "Formulário de solicitação de contrato",
};

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-gray-50">
        <main className="max-w-2xl mx-auto px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
