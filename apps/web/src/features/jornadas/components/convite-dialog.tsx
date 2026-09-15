"use client";

import { AstroMark } from "@nerp/astro-widget";
import { Clock, Footprints, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useJornadaStore } from "../hooks/use-jornada-store";
import { useIniciarJornada } from "../hooks/use-jornadas";

export interface JornadaDoConvite {
  id: string;
  titulo: string;
  descricao: string;
  totalPassos: number;
  minutos: number;
  stars: number;
  recompensaDaOrg: { creditada: boolean; porNome: string | null };
}

/**
 * O convite: o que a jornada ensina, quanto tempo leva e quanto paga.
 *
 * A regra das ★ é dita ANTES de começar, e em destaque. Quem descobre no fim
 * que correr demais não valeu se sente enganado — e com razão.
 */
export function ConviteDialog({
  jornada,
  organizationId,
  aberto,
  aoFechar,
}: {
  jornada: JornadaDoConvite;
  organizationId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const iniciar = useIniciarJornada();
  const comecar = useJornadaStore((estado) => estado.comecar);

  const aoComecar = async () => {
    const resposta = await iniciar.mutateAsync({ jornadaId: jornada.id });
    comecar({
      jornadaId: jornada.id,
      organizationId,
      iniciadaEm: resposta.iniciadaEm,
    });
    aoFechar();
  };

  const daEstrelas = jornada.stars > 0 && !jornada.recompensaDaOrg.creditada;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {/* O tamanho mora no PAI: `.o-astro-mark` do pacote fixa a marca em
                100% do espaço dela, e classe de tamanho nela não pega. */}
            <span className="size-9 shrink-0">
              <AstroMark />
            </span>
            <DialogTitle className="text-left">{jornada.titulo}</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-left">
            {jornada.descricao}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1.5">
            <Footprints className="size-4" />
            {jornada.totalPassos} passos
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />~{jornada.minutos} min
          </span>
          {jornada.stars > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Star className="size-4 text-amber-500" />
              {jornada.stars} ★
            </span>
          )}
        </div>

        {daEstrelas && (
          <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Só ganha quem faz passo a passo
            </p>
            <p className="mt-1 text-muted-foreground">
              Eu vou destacando o que clicar e você clica. Clicar em "Próximo"
              correndo não conta — as ★ entram no saldo da empresa quando a
              jornada é feita de verdade.
            </p>
          </div>
        )}

        {jornada.recompensaDaOrg.creditada && (
          <div className="rounded-lg bg-muted p-3 text-muted-foreground text-sm">
            {jornada.recompensaDaOrg.porNome
              ? `${jornada.recompensaDaOrg.porNome} já garantiu as ★ desta jornada para a empresa.`
              : "As ★ desta jornada já foram resgatadas na empresa."}{" "}
            Esta rodada é só para você aprender.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={aoFechar}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={aoComecar}
            disabled={iniciar.isPending}
          >
            Começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
