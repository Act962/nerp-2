"use client";

import {
  type AstroAnimacao,
  ASTRO_VIEWBOX,
  type AstroCamada,
  cenaNova,
  slugificarAnimacao,
} from "@nerp/site-content";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import type { Manifesto, Pecas } from "../../lib/astro-catalogo";
import {
  fundoDaPose,
  montarPose,
  type PoseDefinida,
  POSES,
} from "../../lib/astro-poses";

/**
 * A estante de poses prontas.
 *
 * Cada quadro desenha a pose de verdade — as mesmas camadas que o palco vai
 * montar — em DOM simples, não em Konva: são 25 miniaturas e nenhuma delas
 * precisa de alça, seleção ou exportação. Konva aqui seriam 25 canvas para
 * mostrar figuras paradas.
 *
 * Ver as 25 lado a lado não é conforto: é a única forma de julgar se uma pose
 * ficou legível. Compor uma a uma no escuro é como o enquadramento sai errado.
 */

export function Poses({
  manifesto,
  pecas,
  aoEscolher,
}: {
  manifesto: Manifesto | null;
  pecas: Pecas | null;
  aoEscolher: (cena: AstroAnimacao) => void;
}) {
  if (!manifesto || !pecas) return null;

  return (
    <div className="grid max-h-[26rem] w-[34rem] grid-cols-5 gap-1.5 overflow-y-auto">
      {POSES.map((pose) => (
        <button
          key={pose.id}
          type="button"
          onClick={() => aoEscolher(cenaDaPose(pose, manifesto, pecas))}
          className="flex flex-col items-center gap-1 rounded-md border p-1 transition-colors hover:border-primary"
          title={pose.nome}
        >
          <MiniaturaDaPose pose={pose} manifesto={manifesto} pecas={pecas} />
          <span className="w-full truncate text-[10px] leading-none text-muted-foreground">
            {pose.nome}
          </span>
        </button>
      ))}
    </div>
  );
}

/** A pose como cena salvável: fundo travado + as camadas dela. */
export function cenaDaPose(
  pose: PoseDefinida,
  m: Manifesto,
  p: Pecas,
): AstroAnimacao {
  return {
    ...cenaNova(pose.nome),
    slug: slugificarAnimacao(pose.nome),
    momento: pose.momento ?? null,
    camadas: [fundoDaPose(), ...montarPose(pose, m, p)],
  };
}

const LADO = 92;

function MiniaturaDaPose({
  pose,
  manifesto,
  pecas,
}: {
  pose: PoseDefinida;
  manifesto: Manifesto;
  pecas: Pecas;
}) {
  const camadas = montarPose(pose, manifesto, pecas);
  const altura = Math.round((LADO * ASTRO_VIEWBOX.h) / ASTRO_VIEWBOX.w);

  return (
    <span
      className="relative block overflow-hidden rounded-sm bg-[#011121]"
      // `containerType: size` é o que faz `cqw`/`cqh` valerem a régua da
      // MINIATURA — a mesma unidade que o player usa, para o quadro ser a cena
      // encolhida e não outro desenho.
      style={{ width: LADO, height: altura, containerType: "size" }}
    >
      {camadas.map((c) => (
        <Peca key={c.id} camada={c} />
      ))}
    </span>
  );
}

function Peca({ camada }: { camada: AstroCamada }) {
  if (camada.tipo !== "imagem" || !camada.src) return null;
  const { ini } = camada;
  // A mesma conta do palco e do player: posição em porcentagem da régua da
  // cena, para a miniatura ser a cena encolhida e não outro desenho.
  const px = ((ini.x - camada.largura / 2) / ASTRO_VIEWBOX.w) * 100;
  const py = ((ini.y - camada.altura / 2) / ASTRO_VIEWBOX.h) * 100;

  return (
    // biome-ignore lint/performance/noImgElement: miniatura de 92px vinda do /public, sem otimização a fazer
    <img
      src={constructUrl(camada.src)}
      alt=""
      className={cn("absolute left-0 top-0")}
      style={{
        width: `${(camada.largura / ASTRO_VIEWBOX.w) * 100}%`,
        height: `${(camada.altura / ASTRO_VIEWBOX.h) * 100}%`,
        transform: `translate(${px}cqw, ${py}cqh) rotate(${ini.rot}deg) scale(${camada.espelhoX ? -1 : 1}, 1)`,
        transformOrigin: "50% 50%",
      }}
    />
  );
}
