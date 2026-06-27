import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Login — E-TAX Ops" };

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-full bg-[var(--color-bg)]">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <Image
            src="/LOGO ETAX PNG-07.png"
            alt="E-TAX"
            width={48}
            height={48}
            className="mx-auto mb-3"
          />
          <h1 className="font-heading text-2xl font-semibold text-[var(--color-text)]">
            E-TAX Ops
          </h1>
          <p className="text-sm text-[var(--color-text-mute)] mt-1">
            Entre com sua conta para continuar
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-[var(--color-text-mute)]">
          Não tem conta?{" "}
          <Link href="/signup" className="text-[var(--color-text-soft)] hover:text-[var(--color-text)] font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
