"use client";

import type { AstroCamada } from "@nerp/site-content";
import {
  Circle,
  Eye,
  Hand,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Smile,
  Volleyball,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ModeloDePeca } from "../../lib/astro-catalogo";

/**
 * A paleta de peças.
 *
 * Mora na barra de cima, junto de "Nova" e "Salvar", porque acrescentar uma
 * peça é uma ação sobre a CENA — não uma propriedade da lista de camadas, que
 * é só o retrato do que já existe.
 *
 * A paleta cobre tudo o que o X da lista consegue apagar, e isso é a regra: o
 * dia em que der para apagar algo que não dá para repor, o editor vira uma
 * armadilha.
 */

export type PecaNova =
  | "globo"
  | "boca"
  | "olho-esq"
  | "olho-dir"
  | "mao"
  | "bola"
  | "balao";

export function Adicionar({
  camadas,
  objetos,
  enviando,
  aoAdicionar,
  aoAdicionarObjeto,
  aoEnviarImagem,
}: {
  camadas: AstroCamada[];
  objetos: ModeloDePeca[];
  enviando: boolean;
  aoAdicionar: (peca: PecaNova) => void;
  aoAdicionarObjeto: (m: ModeloDePeca) => void;
  aoEnviarImagem: () => void;
}) {
  // O balão é único: a cena aceita um texto, não vários.
  const temBalao = camadas.some((c) => c.id === "balao");

  return (
    <div className="flex w-80 flex-col gap-2">
      <Grupo titulo="Rosto">
        <Peca icone={<Circle />} onClick={() => aoAdicionar("globo")}>
          Globo
        </Peca>
        <Peca icone={<Smile />} onClick={() => aoAdicionar("boca")}>
          Boca
        </Peca>
        <Peca icone={<Eye />} onClick={() => aoAdicionar("olho-esq")}>
          Olho esq.
        </Peca>
        <Peca icone={<Eye />} onClick={() => aoAdicionar("olho-dir")}>
          Olho dir.
        </Peca>
      </Grupo>

      <Separator />

      <Grupo titulo="Mãos">
        <Peca icone={<Hand />} onClick={() => aoAdicionar("mao")}>
          Mão
        </Peca>
        <Peca icone={<Volleyball />} onClick={() => aoAdicionar("bola")}>
          Bola branca
        </Peca>
      </Grupo>

      <Separator />

      <Grupo titulo="Cena">
        <Peca
          icone={<MessageSquarePlus />}
          onClick={() => aoAdicionar("balao")}
          desativado={temBalao}
        >
          Balão
        </Peca>
        <Peca
          icone={
            enviando ? <Loader2 className="animate-spin" /> : <ImageIcon />
          }
          onClick={aoEnviarImagem}
          desativado={enviando}
        >
          Do computador
        </Peca>
      </Grupo>

      {objetos.length > 0 && (
        <>
          <Separator />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Objetos
          </p>
          <div className="grid max-h-48 grid-cols-5 gap-1 overflow-y-auto">
            {objetos.map((o) => (
              <button
                key={o.id}
                type="button"
                title={o.nome}
                onClick={() => aoAdicionarObjeto(o)}
                className="flex aspect-square items-center justify-center rounded-md border bg-slate-400 p-1 transition-colors hover:border-primary"
              >
                {/* biome-ignore lint/performance/noImgElement: miniatura de 48px vinda do /public, sem otimização a fazer */}
                <img
                  src={o.src}
                  alt={o.nome}
                  className="max-h-full max-w-full object-contain"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {titulo}
      </p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function Peca({
  icone,
  children,
  onClick,
  desativado,
}: {
  icone: ReactNode;
  children: ReactNode;
  onClick: () => void;
  desativado?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="justify-start gap-1.5 [&_svg]:size-3.5"
      onClick={onClick}
      disabled={desativado}
    >
      {icone}
      {children}
    </Button>
  );
}
