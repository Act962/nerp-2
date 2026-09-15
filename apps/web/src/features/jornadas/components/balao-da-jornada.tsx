"use client";

import { AstroMark } from "@nerp/astro-widget";
import { Button } from "@/components/ui/button";
import type { Passo } from "../catalogo/tipos";

const DICA: Record<Passo["tipo"], string | null> = {
  ler: null,
  clicar: "Clique no que está destacado",
  digitar: "Digite no campo destacado",
  navegar: "Continue — eu sigo com você na próxima tela",
};

/**
 * O balão que o Astro usa para explicar o passo.
 *
 * Ele não fecha a jornada por conta própria e não some sozinho: quem encerra é
 * sempre a pessoa, no "Fechar instrução". Balão que desaparece no meio de uma
 * explicação é pior do que balão nenhum.
 */
export function BalaoDaJornada({
  passo,
  indice,
  total,
  falaDePressa,
  podeAvancar,
  aoAvancar,
  aoFechar,
}: {
  passo: Passo;
  indice: number;
  total: number;
  falaDePressa: boolean;
  podeAvancar: boolean;
  aoAvancar: () => void;
  aoFechar: () => void;
}) {
  const dica = DICA[passo.tipo];

  return (
    <>
      <div className="flex items-start gap-2">
        {/* O tamanho vem do pai: a marca do pacote ocupa 100% de quem a
            envolve. */}
        <span className="mt-0.5 size-7 shrink-0">
          <AstroMark />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{passo.titulo}</p>
          <p className="mt-1 text-muted-foreground">{passo.texto}</p>
        </div>
      </div>

      {falaDePressa && (
        <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-700 text-xs dark:text-amber-400">
          Tá ligado que eu sei que tá com pressa! Mas as ★ só vêm pra quem faz
          passo a passo.
        </p>
      )}

      {dica && <p className="mt-2 font-medium text-primary text-xs">{dica}</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          Passo {indice + 1} de {total}
        </span>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={aoFechar}>
            Fechar instrução
          </Button>
          {podeAvancar && (
            <Button type="button" size="sm" onClick={aoAvancar}>
              Próximo
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
