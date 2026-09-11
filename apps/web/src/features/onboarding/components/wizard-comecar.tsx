"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { NICHO_IDS, NICHOS, nichoPorId } from "../lib/nichos";
import {
  codificarRespostas,
  RESPOSTAS_COOKIE,
  type RespostasDoWizard,
} from "../lib/respostas";
import { SOLUCAO_IDS, SOLUCOES, type SolucaoId } from "../lib/solucoes";

/**
 * "Começar agora": dois passos puláveis — o ramo e as soluções de
 * interesse — e a empresa de teste nasce no fim, com dados de exemplo do
 * ramo e o guia das soluções marcadas. Estado na URL até o fim; nada é
 * gravado antes. Sem IA.
 */

const PASSOS = ["nicho", "solucoes"] as const;

export function WizardComecar() {
  const router = useRouter();
  const [passo, setPasso] = useQueryState(
    "passo",
    parseAsStringLiteral(PASSOS).withDefault("nicho"),
  );
  const [nicho, setNicho] = useQueryState(
    "nicho",
    parseAsStringLiteral(NICHO_IDS),
  );
  const [interesses, setInteresses] = useQueryState(
    "solucoes",
    parseAsArrayOf(parseAsStringLiteral(SOLUCAO_IDS)).withDefault([]),
  );
  const [criando, setCriando] = useState(false);

  const escolherNicho = (id: (typeof NICHO_IDS)[number]) => {
    setNicho(id);
    // O ramo pré-marca as soluções; quem já marcou algo não perde.
    const sugeridas = nichoPorId(id)?.interesses ?? [];
    setInteresses(interesses.length > 0 ? interesses : sugeridas);
  };

  const alternar = (id: SolucaoId) => {
    setInteresses(
      interesses.includes(id)
        ? interesses.filter((s) => s !== id)
        : [...interesses, id],
    );
  };

  const comecar = async () => {
    setCriando(true);
    const respostas: RespostasDoWizard = {
      nicho: nicho ?? undefined,
      segment: nichoPorId(nicho)?.segment,
      interesses,
    };
    // O cookie é lido pelo servidor no `after` do sign-in anônimo — 10 min
    // bastam para o round-trip; depois ele é apagado.
    // biome-ignore lint/suspicious/noDocumentCookie: a Cookie Store API não existe no Safari; é um cookie curto, de leitura única pelo servidor.
    document.cookie = `${RESPOSTAS_COOKIE}=${codificarRespostas(respostas)}; path=/; max-age=600; SameSite=Lax`;

    const { data: sessao } = await authClient.getSession();
    if (sessao?.user) {
      const anonimo = (sessao.user as { isAnonymous?: boolean }).isAnonymous;
      router.push(anonimo ? "/dashboard" : "/create-organization");
      return;
    }

    const { error } = await authClient.signIn.anonymous();
    if (error) {
      setCriando(false);
      toast.error(
        error.status === 429
          ? "Muitas contas de teste criadas deste endereço hoje. Entre com o Google ou tente amanhã."
          : "Não deu para criar sua empresa de teste agora. Tente de novo.",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ol className="flex items-center gap-2 text-muted-foreground text-xs">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[11px]",
                passo === p &&
                  "border-primary bg-primary text-primary-foreground",
              )}
            >
              {i + 1}
            </span>
            {p === "nicho" ? "Seu ramo" : "Suas soluções"}
            {i < PASSOS.length - 1 ? <span className="mx-1">›</span> : null}
          </li>
        ))}
      </ol>

      {passo === "nicho" ? (
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="font-semibold text-2xl">Qual é o seu ramo?</h1>
            <p className="text-muted-foreground text-sm">
              A empresa de teste já nasce com produtos, clientes e um catálogo
              do seu jeito. Dá para pular.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {NICHOS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => escolherNicho(n.id)}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-accent",
                  nicho === n.id &&
                    "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <span className="font-medium">{n.nome}</span>
                <span className="text-muted-foreground text-sm">
                  {n.resumo}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPasso("solucoes")}>
              Pular
            </Button>
            <Button onClick={() => setPasso("solucoes")}>
              Continuar <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="font-semibold text-2xl">
              O que você quer resolver?
            </h1>
            <p className="text-muted-foreground text-sm">
              Marque o que interessa: essas soluções ficam em destaque no menu e
              viram o seu guia de primeiros passos. Tudo continua disponível.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOLUCOES.map((s) => {
              const marcada = interesses.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => alternar(s.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent",
                    marcada && "border-primary bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                      marcada &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {marcada ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-sm">{s.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      {s.descricao}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setPasso("nicho")}
              disabled={criando}
            >
              Voltar
            </Button>
            <Button onClick={comecar} disabled={criando}>
              {criando ? <Loader2 className="size-4 animate-spin" /> : null}
              {interesses.length > 0
                ? "Criar minha empresa de teste"
                : "Pular e começar"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
