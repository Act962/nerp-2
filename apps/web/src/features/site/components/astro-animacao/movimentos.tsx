"use client";

import {
  ASTRO_VIEWBOX,
  type AstroCamada,
  CAMADA_PADRAO,
  ESTADO_ZERO,
  estadoNoTempo,
  type Movimento,
  MOVIMENTOS,
} from "@nerp/site-content";
import { useCallback, useMemo, useRef } from "react";
import { BolaDaPrevia, usePincel } from "./previa";

/**
 * A grade de tipos de movimento, cada um mostrando o que faz.
 *
 * A bolinha de cada quadro é movida pelo MESMO `estadoNoTempo` que move a cena
 * — não é uma animação em CSS parecida com o resultado. Fosse uma imitação, a
 * prévia acabaria discordando do palco no dia em que a conta do tempo mudasse,
 * e escolher pela prévia passaria a ser escolher errado.
 *
 * O que a prévia NÃO reproduz é a amplitude: um tremor de 12 unidades num
 * quadro de 76px seria meio pixel, invisível. Cada quadro mede o próprio
 * deslocamento e o normaliza para caber — mostra o GESTO, e os números reais
 * ficam nos campos ao lado.
 */

const QUADRO = { w: 76, h: 44 };
/** Quanto do quadro o maior deslocamento pode ocupar, de cada lado do centro. */
const ALCANCE = { x: 26, y: 14 };

/** A bola de mentira: uma camada como outra qualquer, no centro da cena. */
const BOLA: AstroCamada = {
  id: "bola-da-previa",
  nome: "Bola",
  tipo: "imagem",
  src: "",
  texto: "",
  cor: "#011121",
  largura: 120,
  altura: 120,
  ...CAMADA_PADRAO,
  ini: { ...ESTADO_ZERO, x: ASTRO_VIEWBOX.w / 2, y: ASTRO_VIEWBOX.h / 2 },
  fim: { ...ESTADO_ZERO, x: ASTRO_VIEWBOX.w / 2, y: ASTRO_VIEWBOX.h / 2 },
};

type Ensaio = {
  camada: AstroCamada;
  /** quanto dura um ciclo completo, ida e volta quando houver */
  ciclo: number;
  /** unidades da cena → pixels do quadro, por eixo */
  escala: { x: number; y: number };
};

/**
 * Ensaia o movimento uma vez para descobrir o quanto ele anda.
 *
 * A amostragem é grosseira de propósito (32 pontos): o que se quer é a ordem
 * de grandeza do deslocamento, não o extremo exato.
 */
function ensaiar(mov: Movimento): Ensaio {
  const camada = { ...BOLA, ...mov.aplicar(BOLA) } as AstroCamada;
  // O ciclo inclui o descanso: sem ele o quadro do "piscar" repetiria só o
  // décimo de segundo em que o olho some, e a pausa — que é o que caracteriza
  // piscar — não apareceria.
  const ciclo = Math.max(
    camada.duracao * (camada.vaivem ? 2 : 1) + camada.intervalo,
    0.1,
  );

  let maiorX = 0;
  let maiorY = 0;
  for (let i = 0; i <= 32; i++) {
    const e = estadoNoTempo(camada, (ciclo * i) / 32);
    maiorX = Math.max(maiorX, Math.abs(e.x - camada.ini.x));
    maiorY = Math.max(maiorY, Math.abs(e.y - camada.ini.y));
  }

  return {
    camada,
    ciclo,
    escala: {
      x: maiorX > 0 ? ALCANCE.x / maiorX : 0,
      y: maiorY > 0 ? ALCANCE.y / maiorY : 0,
    },
  };
}

export function Movimentos({
  aoEscolher,
}: {
  aoEscolher: (m: Movimento) => void;
}) {
  const bolas = useRef<(HTMLSpanElement | null)[]>([]);
  const ensaios = useMemo(() => MOVIMENTOS.map(ensaiar), []);

  const pintar = useCallback(
    (t: number) => {
      ensaios.forEach((ensaio, i) => {
        const el = bolas.current[i];
        if (!el) return;
        // Cada quadro corre no próprio ciclo, para nenhum ficar cortado pela
        // metade quando o laço reinicia.
        const e = estadoNoTempo(ensaio.camada, t % ensaio.ciclo);
        const dx = (e.x - ensaio.camada.ini.x) * ensaio.escala.x;
        const dy = (e.y - ensaio.camada.ini.y) * ensaio.escala.y;
        // O `translate(-50%, -50%)` vem junto porque é ele que centra a bola
        // no quadro: escrever só o deslocamento a jogaria para o canto.
        el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${e.rot}deg) scale(${e.esc})`;
        el.style.opacity = String(e.op);
      });
    },
    [ensaios],
  );

  usePincel(pintar);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {MOVIMENTOS.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onClick={() => aoEscolher(m)}
          className="flex flex-col items-center gap-1 rounded-md border bg-[#04101f] p-1 transition-colors hover:border-primary"
        >
          <span
            className="relative block overflow-hidden"
            style={{ width: QUADRO.w, height: QUADRO.h }}
          >
            <BolaDaPrevia
              refBola={(el) => {
                bolas.current[i] = el;
              }}
            />
          </span>
          <span className="text-[10px] leading-none text-white/70">
            {m.nome}
          </span>
        </button>
      ))}
    </div>
  );
}
