"use client";

import type { AstroAnimacao, AstroCamada } from "@nerp/site-content";
import { nomeDoMomento } from "@nerp/site-content";
import { Eye, EyeOff, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Salva = {
  id: string;
  slug: string;
  nome: string;
  momento: string | null;
  atualizadaEm: string;
};

/** A coluna da esquerda: as camadas, os ajustes da cena e o que já foi salvo. */
export function Camadas({
  cena,
  sel,
  salvas,
  slugAberto,
  aoSelecionar,
  aoMudarCamada,
  aoApagarCamada,
  aoMudarCena,
  aoAbrir,
  aoExcluir,
}: {
  cena: AstroAnimacao;
  sel: string;
  salvas: Salva[];
  slugAberto: string;
  aoSelecionar: (id: string) => void;
  aoMudarCamada: (id: string, troca: Partial<AstroCamada>) => void;
  aoApagarCamada: (id: string) => void;
  aoMudarCena: (troca: Partial<AstroAnimacao>) => void;
  aoAbrir: (slug: string) => void;
  aoExcluir: (slug: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r bg-card p-3">
      <Titulo>Camadas</Titulo>

      <div className="flex flex-col gap-0.5">
        {/* de cima para baixo é da frente para o fundo, como em todo editor */}
        {[...cena.camadas].reverse().map((camada) => (
          <div
            key={camada.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors",
              sel === camada.id ? "bg-accent" : "hover:bg-muted",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label={
                camada.visivel
                  ? `Esconder ${camada.nome}`
                  : `Mostrar ${camada.nome}`
              }
              onClick={() =>
                aoMudarCamada(camada.id, { visivel: !camada.visivel })
              }
            >
              {camada.visivel ? (
                <Eye className="size-3.5" />
              ) : (
                <EyeOff className="size-3.5" />
              )}
            </Button>
            <button
              type="button"
              onClick={() => aoSelecionar(camada.id)}
              className={cn(
                "min-w-0 flex-1 truncate py-1 text-left text-sm",
                camada.visivel
                  ? "text-foreground"
                  : "text-muted-foreground line-through",
              )}
            >
              {camada.nome}
            </button>
            {/*
              O fundo é travado e não tem o X: cena sem fundo não é uma cena
              mais enxuta, é uma cena com um buraco. Para as outras, apagar é
              seguro — "+ Mão" e "+ Balão de texto" trazem de volta, e o que
              vale mesmo é não ter salvado ainda.
            */}
            {!camada.travada && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                aria-label={`Apagar ${camada.nome}`}
                onClick={() => aoApagarCamada(camada.id)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Separator />
      <Titulo>Cena</Titulo>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anim-duracao" className="text-xs">
          Duração total (s)
        </Label>
        <Input
          id="anim-duracao"
          type="number"
          step="0.1"
          min="0.2"
          value={cena.duracao}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v > 0) aoMudarCena({ duracao: v });
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="anim-repete" className="text-xs font-normal">
          Repetir a cena
        </Label>
        <Switch
          id="anim-repete"
          checked={cena.repete}
          onCheckedChange={(v) => aoMudarCena({ repete: v })}
        />
      </div>

      {salvas.length > 0 && (
        <>
          <Separator />
          <Titulo>Salvas</Titulo>
          <div className="flex flex-col gap-1">
            {salvas.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-1",
                  slugAberto === a.slug ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => aoAbrir(a.slug)}
                  className="min-w-0 flex-1 py-1.5 text-left"
                >
                  <span className="block truncate text-sm">{a.nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {a.momento ? nomeDoMomento(a.momento) : "rascunho"}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  aria-label={`Excluir ${a.nome}`}
                  onClick={() => aoExcluir(a.slug)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}
