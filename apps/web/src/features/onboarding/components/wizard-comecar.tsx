"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  INTERESSES_PADRAO,
  MAX_RAMO_LIVRE,
  NICHO_IDS,
  NICHOS,
  nichoPorId,
} from "../lib/nichos";
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
  const [ramo, setRamo] = useQueryState("ramo");
  /*
    A pessoa já mexeu na lista com a própria mão?

    Sem esta marca, trocar de ramo não mudava nada: a sugestão só era aplicada
    com a lista vazia, e ela nunca mais ficava vazia. Quem escolhia
    "Supermercados", voltava e escolhia "Clínicas" continuava com o conjunto do
    supermercado — o sistema ignorando a resposta que a pessoa acabou de
    corrigir. Com a marca, o ramo manda enquanto ninguém mexeu, e para de
    mandar no instante em que alguém mexe.
  */
  const [editado, setEditado] = useQueryState(
    "editado",
    parseAsBoolean.withDefault(false),
  );
  const [criando, setCriando] = useState(false);

  const escolherNicho = (id: (typeof NICHO_IDS)[number]) => {
    setNicho(id);
    if (editado) return;
    setInteresses(nichoPorId(id)?.interesses ?? []);
  };

  const alternar = (id: SolucaoId) => {
    setEditado(true);
    setInteresses(
      interesses.includes(id)
        ? interesses.filter((s) => s !== id)
        : [...interesses, id],
    );
  };

  const nichoEscolhido = nichoPorId(nicho);

  const comecar = async () => {
    setCriando(true);
    const respostas: RespostasDoWizard = {
      nicho: nicho ?? undefined,
      // No "Outro" a tela NÃO decide o segmento: quem decide é o servidor, a
      // partir das soluções marcadas. Mandar "VAREJO" aqui atropelaria a
      // dedução com um chute.
      segment:
        nicho && nicho !== "outro" ? nichoPorId(nicho)?.segment : undefined,
      ramo: nicho === "outro" ? (ramo ?? undefined) : undefined,
      // Guia vazio é a tela dizendo "vire-se": quem não marcou nada leva o
      // conjunto padrão, que é palpite, mas é palpite com passos.
      interesses: interesses.length > 0 ? interesses : INTERESSES_PADRAO,
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
              Serve para marcar as soluções certas e organizar o seu menu. A
              empresa de teste já nasce com produtos, clientes e um catálogo
              para você mexer. Dá para pular.
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

          {nicho === "outro" && (
            /*
              O campo só aparece depois de escolher "Outro": um input solto ao
              lado de seis cartões parece obrigatório, e ele não é. O que for
              escrito aqui vira o ramo da organização — é o sinal que diz
              quais pacotes de exemplo vale construir depois.
            */
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="ramo-livre">
                O que a sua empresa faz?
              </label>
              <Input
                id="ramo-livre"
                autoFocus
                maxLength={MAX_RAMO_LIVRE}
                placeholder="Pet shop, papelaria, distribuidora de bebidas…"
                value={ramo ?? ""}
                onChange={(evento) => setRamo(evento.target.value || null)}
              />
              <p className="text-muted-foreground text-xs">
                Opcional. Serve para a gente saber quais ramos estão chegando.
              </p>
            </div>
          )}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                // Pular é "não quero responder", e não "nenhum destes": quem
                // pula ainda assim leva soluções marcadas, para não cair num
                // dashboard com o guia em branco.
                if (interesses.length === 0) setInteresses(INTERESSES_PADRAO);
                setPasso("solucoes");
              }}
            >
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
              {nichoEscolhido && !editado
                ? `Já marcamos o que costuma servir a ${nichoEscolhido.nome.toLowerCase()} — desmarque o que você não usa.`
                : "Marque o que interessa."}{" "}
              Essas soluções ficam em destaque no menu e viram o seu guia de
              primeiros passos. Tudo continua disponível.
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
          {interesses.length === 0 && (
            /*
              Desmarcar tudo é uma escolha, e o servidor repõe o básico para o
              guia não nascer vazio. Dizer isso aqui evita a surpresa de chegar
              ao painel com cinco itens que ninguém marcou.
            */
            <p className="text-muted-foreground text-xs">
              Sem nada marcado, começamos pelo básico: produtos, estoque,
              catálogo, WhatsApp e o Astro.
            </p>
          )}
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
              {criando
                ? "Montando sua empresa…"
                : "Criar minha empresa de teste"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
