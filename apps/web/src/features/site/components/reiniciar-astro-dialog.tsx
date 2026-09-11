"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarEstrelas } from "@/features/stars/lib/decimal";
import {
  useDiagnosticoDoAstro,
  useReiniciarAstro,
  useTestarChaveDoAstro,
} from "../hooks/use-site-admin";
import { desde } from "./periodo-do-painel";

/**
 * "O Astro parou nesta empresa" — o que dá para ver e o que dá para reiniciar.
 *
 * O aviso sobre o navegador não é enfeite: o histórico da conversa mora no
 * `sessionStorage` da aba de quem está falando e é reenviado inteiro a cada
 * mensagem. Encerrar a sessão no servidor não toca nisso. Sem essa frase, o
 * admin clica, vê "reiniciado", e o cliente continua travado — que é o pior
 * desfecho possível para um botão de suporte.
 */

const EXPLICACAO: Record<string, { titulo: string; detalhe: string }> = {
  ok: {
    titulo: "Nenhuma trava ativa",
    detalhe:
      "O Astro responde nesta empresa agora. Se o cliente ainda vê a conversa parada, o problema está na aba dele.",
  },
  desligado: {
    titulo: "Astro desligado no painel",
    detalhe:
      "O interruptor vale para os dois canais — site e app. Ligue em Faixas do Astro.",
  },
  sem_chave: {
    titulo: "Sem chave de IA",
    detalhe:
      "Nenhum provedor respondeu à configuração atual. É variável de ambiente, não dá para resolver por aqui.",
  },
  teto_diario: {
    titulo: "Teto diário batido",
    detalhe:
      "A empresa passou do limite de mensagens por dia. Liberar o teto abaixo zera a contagem das últimas 24 horas.",
  },
  sem_saldo: {
    titulo: "Sem ★ suficientes",
    detalhe:
      "O saldo não cobre nem o primeiro bloco de tokens. Credite ★ pela tabela.",
  },
};

export function ReiniciarAstroDialog({
  empresa,
  onClose,
}: {
  empresa: { id: string; nome: string } | null;
  onClose: () => void;
}) {
  const [liberarTeto, setLiberarTeto] = useState(false);
  const [apagarMemoria, setApagarMemoria] = useState(false);
  const { diagnostico, isLoading } = useDiagnosticoDoAstro(empresa?.id ?? null);
  const reiniciar = useReiniciarAstro();
  const testar = useTestarChaveDoAstro();

  const fechar = () => {
    setLiberarTeto(false);
    setApagarMemoria(false);
    onClose();
  };

  const explicacao = diagnostico ? EXPLICACAO[diagnostico.motivo] : null;
  const travado = diagnostico ? diagnostico.motivo !== "ok" : false;

  return (
    <Dialog
      open={empresa !== null}
      onOpenChange={(aberto) => !aberto && fechar()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reiniciar o Astro</DialogTitle>
          <DialogDescription>{empresa?.nome}</DialogDescription>
        </DialogHeader>

        {isLoading || !diagnostico || !explicacao ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <Alert variant={travado ? "destructive" : "default"}>
              {travado ? (
                <AlertTriangle className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              <AlertDescription>
                <p>
                  <span className="font-semibold">{explicacao.titulo}.</span>{" "}
                  {explicacao.detalhe}
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <div className="min-w-48 flex-1 text-sm">
                <p className="font-medium">A chave de IA responde?</p>
                <p className="text-xs text-muted-foreground">
                  Chave configurada não é chave funcionando — só uma chamada de
                  verdade diz.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testar.mutate({})}
                disabled={testar.isPending}
              >
                {testar.isPending ? "Testando…" : "Testar chave"}
              </Button>
            </div>

            {testar.data && (
              <div className="flex flex-col gap-2">
                {testar.data.modelos.map((teste) => (
                  <Alert
                    key={teste.nivel}
                    variant={teste.ok ? "default" : "destructive"}
                  >
                    {teste.ok ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <AlertTriangle className="size-4" />
                    )}
                    <AlertDescription>
                      <p>
                        <span className="font-semibold">
                          {teste.nivel}: {teste.modelo}
                        </span>{" "}
                        {teste.ok ? "respondeu." : "recusou."}
                      </p>
                      {teste.erro && (
                        <p className="break-all font-mono text-xs">
                          {teste.erro}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Linha rotulo="Saldo">
                {formatarEstrelas(diagnostico.saldo)} ★
              </Linha>
              <Linha rotulo="Mensagens em 24 h">
                {diagnostico.mensagensNoDia}
                {diagnostico.tetoPorOrg > 0
                  ? ` de ${diagnostico.tetoPorOrg}`
                  : " (sem teto)"}
              </Linha>
              <Linha rotulo="Conversas abertas">
                {diagnostico.sessoesAbertas}
              </Linha>
              <Linha rotulo="Última conversa">
                {diagnostico.ultimaConversa
                  ? desde(diagnostico.ultimaConversa)
                  : "nunca"}
              </Linha>
            </dl>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-2 text-sm">
                <Checkbox
                  id="liberar-teto"
                  className="mt-0.5"
                  checked={liberarTeto}
                  onCheckedChange={(v) => setLiberarTeto(v === true)}
                />
                <label htmlFor="liberar-teto">
                  Liberar o teto do dia
                  <span className="block text-xs text-muted-foreground">
                    Zera a contagem de mensagens das últimas 24 horas. Os tokens
                    e o custo ficam intactos.
                  </span>
                </label>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <Checkbox
                  id="apagar-memoria"
                  className="mt-0.5"
                  checked={apagarMemoria}
                  onCheckedChange={(v) => setApagarMemoria(v === true)}
                />
                <label htmlFor="apagar-memoria">
                  Apagar a memória do Astro ({diagnostico.memorias})
                  <span className="block text-xs text-muted-foreground">
                    O que a empresa pediu para ele lembrar. Não tem volta.
                  </span>
                </label>
              </div>
            </div>

            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                <p>
                  Isto encerra a conversa{" "}
                  <span className="font-semibold">no servidor</span>. O
                  histórico fica na aba de quem está falando e sobe de novo a
                  cada mensagem — para limpá-lo, a pessoa precisa clicar em{" "}
                  <span className="font-semibold">Recomeçar</span> dentro do
                  próprio Astro.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              empresa &&
              reiniciar.mutate(
                { organizationId: empresa.id, liberarTeto, apagarMemoria },
                { onSuccess: fechar },
              )
            }
            disabled={reiniciar.isPending || isLoading}
          >
            {reiniciar.isPending ? "Reiniciando…" : "Reiniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
