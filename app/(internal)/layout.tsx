import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "../globals.css";

export const metadata: Metadata = {
  title: "Etax Ops",
  description: "Sistema operacional Etax",
};

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 ml-[var(--sidebar-width)] p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
