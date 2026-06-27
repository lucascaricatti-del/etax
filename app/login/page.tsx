import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Login — Etax Ops" };

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-full bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Etax Ops</h1>
          <p className="text-sm text-gray-600 mt-1">
            Entre com sua conta para continuar
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-gray-500">
          Não tem conta?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-800">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
