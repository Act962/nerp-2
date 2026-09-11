"use client";

import { abrirAstro } from "@nerp/astro-widget";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { useSaldo } from "@/features/stars/hooks/use-stars";
import { hasFullAccess } from "@/lib/permissions";
import {
  useOnboardingStatus,
  useRemoverDadosDeExemplo,
} from "../hooks/use-onboarding";

const CHAVE_DISPENSADO = "nerp:boas-vindas:dispensado";

/**
 * O card do primeiro acesso. Aparece enquanto houver dados de exemplo e some
 * ao dispensar (por navegador) ou ao remover os exemplos.
 */
export function BoasVindasCard() {
  const { data: status } = useOnboardingStatus();
  const { data: saldo } = useSaldo();
  const { member } = useCurrentMember();
  const remover = useRemoverDadosDeExemplo();
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    try {
      setDispensado(localStorage.getItem(CHAVE_DISPENSADO) === "1");
    } catch {
      setDispensado(false);
    }
  }, []);

  if (dispensado || !status?.temDadosDeExemplo) return null;

  const dispensar = () => {
    setDispensado(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {}
  };

  const podeRemover = hasFullAccess(member?.role);

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <button
        type="button"
        onClick={dispensar}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Dispensar"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Bem-vindo ao nerp</h2>
          <p className="text-muted-foreground text-sm">
            Deixamos {status.exemplos.produtos} produtos com foto e preço,{" "}
            {status.exemplos.clientes} clientes, {status.exemplos.fornecedores}{" "}
            fornecedores, uma loja e um catálogo promocional prontos para você
            explorar cada tela. Nada disso conta no limite do plano
            {saldo
              ? ` — e você tem ${saldo.saldo} ★ para conversar com o Astro`
              : ""}
            .
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:ps-8">
        <Button size="sm" onClick={abrirAstro}>
          <Sparkles className="size-4" />
          Falar com o Astro
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/configuracoes/planos">Ver planos</Link>
        </Button>
        {podeRemover ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={remover.isPending}>
                {remover.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Remover dados de exemplo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remover os dados de exemplo?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Produtos, clientes, fornecedores, loja e catálogo marcados
                  como exemplo serão apagados. O que já tiver movimento real
                  (uma venda, por exemplo) fica, só deixa de ser exemplo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => remover.mutate({})}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}
