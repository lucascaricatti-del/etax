import "./globals.css";

export const metadata = {
  title: "Página não encontrada — Etax Ops",
};

export default function GlobalNotFound() {
  return (
    <html lang="pt-BR">
      <body className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <p className="text-gray-600">
            A página que você procura não existe.
          </p>
        </div>
      </body>
    </html>
  );
}
