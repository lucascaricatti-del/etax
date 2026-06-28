import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "E-TAX",
  description: "Plataforma de contratos — E-TAX Consultoria Tributária",
  icons: {
    icon: "/LOGO ETAX PNG-07.png",
    apple: "/LOGO ETAX PNG-07.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`h-full ${inter.variable} ${cormorant.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
