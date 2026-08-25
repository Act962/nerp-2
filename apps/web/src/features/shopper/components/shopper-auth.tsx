"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useShopperLogin,
  useShopperSession,
  useShopperSignup,
} from "../hooks/use-shopper-account";

// Login/cadastro do cliente final (identidade global). Redireciona ao destino
// quando a sessão existe.
export function ShopperAuth({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const session = useShopperSession();
  const login = useShopperLogin();
  const signup = useShopperSignup();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const target = redirectTo || "/tradegram/favoritos";
  useEffect(() => {
    if (session) router.replace(target);
  }, [session, router, target]);

  const isPending = login.isPending || signup.isPending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const onError = (error: Error) => toast.error(error.message);
    if (mode === "login") {
      login.mutate({ email, password }, { onError });
    } else {
      signup.mutate(
        { email, password, name: name.trim() || undefined },
        { onError },
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <Link
        href={target}
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Voltar
      </Link>

      <div className="space-y-1">
        <h1 className="font-semibold text-xl">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Favorite produtos, receba alertas de preço e garanta descontos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="shopper-name">Nome</Label>
            <Input
              id="shopper-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="shopper-email">E-mail</Label>
          <Input
            id="shopper-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shopper-password">Senha</Label>
          <Input
            id="shopper-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={6}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Spinner />}
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <button
        type="button"
        className="text-center text-muted-foreground text-sm hover:underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Não tem conta? Cadastre-se"
          : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
