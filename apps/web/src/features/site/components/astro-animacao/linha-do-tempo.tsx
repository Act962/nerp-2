"use client";

import {
  type AstroAnimacao,
  type AstroCamada,
  duracaoReal,
} from "@nerp/site-content";
import { Link2, Pause, Play, Square } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * A faixa de baixo: transporte e uma trilha por camada.
 *
 * Cada trilha mostra onde o movimento começa (atraso) e quanto dura, e é
 * editável por arrasto: puxar o corpo da barra muda o atraso, puxar a borda
 * direita muda a duração. Os campos do painel escrevem nos mesmos dois
 * números — quem arrasta vê o campo mudar junto, e é assim que se descobre o
 * que a barra significa.
 */

/** Passo do arrasto. Frações menores que isto são ruído de mão, não intenção. */
const PASSO = 0.05;

type Arrasto = {
  id: string;
  tipo: "mover" | "esticar";
  x0: number;
  /** o valor no instante em que o arrasto começou */
  base: number;
  /** px por segundo, CONGELADO no início: a régua não pode encolher enquanto
   *  se arrasta, senão a barra foge do cursor. */
  escala: number;
};

export function LinhaDoTempo({
  cena,
  tempo,
  tocando,
  sel,
  aoSelecionar,
  aoMudarCamada,
  aoTocar,
  aoParar,
  aoBuscar,
}: {
  cena: AstroAnimacao;
  tempo: number;
  tocando: boolean;
  sel: string;
  aoSelecionar: (id: string) => void;
  aoMudarCamada: (id: string, troca: Partial<AstroCamada>) => void;
  aoTocar: () => void;
  aoParar: () => void;
  aoBuscar: (t: number) => void;
}) {
  const total = duracaoReal(cena);
  const arrasto = useRef<Arrasto | null>(null);

  const vinculadas = useMemo(() => {
    const ids = new Set<string>();
    for (const c of cena.camadas) {
      if (!c.vinculo) continue;
      ids.add(c.id);
      ids.add(c.vinculo);
    }
    return ids;
  }, [cena.camadas]);

  function comecar(
    ev: React.PointerEvent<HTMLElement>,
    camada: AstroCamada,
    tipo: Arrasto["tipo"],
  ) {
    const faixa = ev.currentTarget.closest<HTMLElement>("[data-faixa]");
    if (!faixa) return;
    aoSelecionar(camada.id);
    arrasto.current = {
      id: camada.id,
      tipo,
      x0: ev.clientX,
      base: tipo === "mover" ? camada.atraso : camada.duracao,
      escala: faixa.clientWidth / total,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    // A alça de esticar vive DENTRO da barra que move: sem parar aqui, o
    // `pointerdown` sobe até ela e o arrasto vira "mover" — esticar nunca
    // aconteceria.
    ev.stopPropagation();
  }

  function mover(ev: React.PointerEvent<HTMLElement>) {
    const a = arrasto.current;
    if (!a) return;
    const delta = (ev.clientX - a.x0) / a.escala;
    const valor = Math.round((a.base + delta) / PASSO) * PASSO;
    // Arredondar para 2 casas: a soma de frações de 0,05 acumula dízima e o
    // campo do painel mostraria `1.3000000000000003`.
    const limpo = Number(
      Math.max(valor, a.tipo === "mover" ? 0 : PASSO).toFixed(2),
    );
    aoMudarCamada(
      a.id,
      a.tipo === "mover" ? { atraso: limpo } : { duracao: limpo },
    );
  }

  function soltar() {
    arrasto.current = null;
  }

  return (
    <footer className="flex min-h-0 flex-col gap-2 border-t bg-card p-3">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" className="gap-1.5" onClick={aoTocar}>
          {tocando ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {tocando ? "Pausar" : "Tocar"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          aria-label="Parar e voltar ao início"
          onClick={aoParar}
        >
          <Square className="size-3.5" />
        </Button>
        <Slider
          className="mx-1 flex-1"
          min={0}
          max={total}
          step={0.01}
          value={[Math.min(tempo, total)]}
          aria-label="Posição na linha do tempo"
          onValueChange={([t]) => aoBuscar(t)}
        />
        <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {tempo.toFixed(2)} / {total.toFixed(2)}s
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {cena.camadas
          .filter((c) => c.tipo !== "cor")
          .map((c) => {
            const inicio = Math.min(c.atraso / total, 1);
            // Piso de 2%: uma camada de 0,05s numa cena de 5s desenharia uma
            // faixa invisível, e a trilha existe justamente para ser vista.
            const largura = Math.max(
              Math.min(c.duracao / total, 1 - inicio),
              0.02,
            );
            return (
              <div
                key={c.id}
                className={cn(
                  "grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-2 rounded-md px-1 py-0.5 transition-colors",
                  sel === c.id ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => aoSelecionar(c.id)}
                  className="flex min-w-0 items-center gap-1 text-left text-xs text-muted-foreground"
                >
                  {/*
                    O elo aparece nos DOIS lados da relação: quem segue e quem é
                    seguido. Ver a corrente inteira de uma vez é o que responde
                    "por que esta camada andou junto?" sem abrir painel nenhum.
                  */}
                  {vinculadas.has(c.id) && (
                    <Link2
                      className="size-3 shrink-0 text-primary"
                      aria-label="Vinculada"
                    />
                  )}
                  <span className="truncate">{c.nome}</span>
                </button>
                <span
                  data-faixa
                  className="relative h-4 rounded-sm bg-muted"
                  title={`começa em ${c.atraso.toFixed(2)}s, dura ${c.duracao.toFixed(2)}s`}
                >
                  <span
                    className="absolute inset-y-0 cursor-grab touch-none rounded-sm bg-primary/80 active:cursor-grabbing"
                    style={{
                      left: `${inicio * 100}%`,
                      width: `${largura * 100}%`,
                    }}
                    onPointerDown={(ev) => comecar(ev, c, "mover")}
                    onPointerMove={mover}
                    onPointerUp={soltar}
                    onPointerCancel={soltar}
                  >
                    {/*
                      A alça de esticar mora DENTRO da barra, encostada na
                      borda direita: fosse ao lado, esticar uma camada curta
                      exigiria mirar num alvo de dois pixels.
                    */}
                    <span
                      className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none rounded-r-sm bg-primary"
                      onPointerDown={(ev) => comecar(ev, c, "esticar")}
                      onPointerMove={mover}
                      onPointerUp={soltar}
                      onPointerCancel={soltar}
                    />
                    {c.repete < 0 && (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] leading-none text-primary-foreground">
                        ∞
                      </span>
                    )}
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </footer>
  );
}
