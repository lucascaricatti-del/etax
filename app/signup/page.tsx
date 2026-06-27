import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Criar conta — Etax Ops" };

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-full bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Etax Ops</h1>
          <p className="text-sm text-gray-600 mt-1">Crie sua conta</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-gray-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
