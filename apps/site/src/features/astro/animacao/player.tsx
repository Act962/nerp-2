"use client";

/**
 * O ASTRO animado nas telas — o outro lado do editor de `/site/animacoes`.
 *
 * De propósito NÃO usa Konva: o editor precisa de canvas por causa das alças e
 * da exportação, mas a tela do visitante só precisa mostrar. Aqui são `<img>`
 * absolutos movidos por `transform`, o que o navegador compõe na GPU sem
 * repintar nada — o widget do consultor não pode gastar quadro com isso.
 *
 * Quem chama diz o MOMENTO, não o arquivo:
 *
 *   <AstroAnimacao momento="popup-sucesso" largura={220} />
 *
 * Qual animação toca naquele momento é decisão de quem edita no admin, e muda
 * sem tocar em código de tela. Enquanto ninguém tiver animado aquele momento —
 * ou com o `apps/web` fora do ar — o componente não desenha nada. Ausência é o
 * estado certo aqui: é o mesmo princípio do resto do site, que nunca cai junto
 * com o ERP.
 */

import {
  ASTRO_VIEWBOX,
  type AstroAnimacao as Cena,
  duracaoReal,
  escalaComEspelho,
  lerAnimacoesPorMomento,
  quadro,
} from "@nerp/site-content";
import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";

type Props = {
  /** o momento da interface; o mapa diz qual animação responde por ele */
  momento?: string;
  /** ou a cena pronta, quando quem chama já a tem em mãos (a prévia do admin) */
  animacao?: Cena;
  /** largura em pixels; a altura sai da proporção da cena */
  largura?: number;
  /** toca uma vez e para no fim, ignorando o laço da cena */
  umaVezSo?: boolean;
  className?: string;
};

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Uma busca por carregamento de página, não uma por componente: o mapa inteiro
 * cabe numa resposta e a mesma tela pode ter o widget, um vazio e um erro.
 */
let mapa: Promise<Record<string, Cena>> | null = null;

function carregarMapa(): Promise<Record<string, Cena>> {
  if (!mapa) {
    mapa = fetch(`${APP_URL}/api/site/astro/animacoes`)
      .then((r) => (r.ok ? r.json() : null))
      .then(lerAnimacoesPorMomento)
      .catch(() => ({}));
  }
  return mapa;
}

export function AstroAnimacao({
  momento,
  animacao,
  largura = 240,
  umaVezSo = false,
  className,
}: Props) {
  const [cena, setCena] = useState<Cena | null>(animacao ?? null);
  const palco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animacao) {
      setCena(animacao);
      return;
    }
    if (!momento) return;
    let vivo = true;
    carregarMapa().then((m) => {
      if (vivo && m[momento]) setCena(m[momento]);
    });
    return () => {
      vivo = false;
    };
  }, [momento, animacao]);

  const altura = Math.round((largura * ASTRO_VIEWBOX.h) / ASTRO_VIEWBOX.w);

  // Quem pediu menos movimento recebe o primeiro quadro, parado.
  const paradoPorPreferencia = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const raiz = palco.current;
    if (!cena || !raiz) return;

    const nos = new Map<string, HTMLElement>();
    for (const camada of cena.camadas) {
      const el = raiz.querySelector<HTMLElement>(
        `[data-camada="${camada.id}"]`,
      );
      if (el) nos.set(camada.id, el);
    }

    const pintar = (t: number) => {
      const estados = quadro(cena, t);
      for (const camada of cena.camadas) {
        const el = nos.get(camada.id);
        if (!el || camada.tipo === "cor") continue;
        const e = estados[camada.id];
        if (!e) continue;
        const px = ((e.x - camada.largura / 2) / ASTRO_VIEWBOX.w) * 100;
        const py = ((e.y - camada.altura / 2) / ASTRO_VIEWBOX.h) * 100;
        const k = escalaComEspelho(camada, e);
        el.style.transform = `translate(${px}cqw, ${py}cqh) rotate(${e.rot}deg) scale(${k.x}, ${k.y})`;
        el.style.opacity = String(e.op);
      }
    };

    if (paradoPorPreferencia) {
      pintar(0);
      return;
    }

    const total = duracaoReal(cena);
    const laco = !umaVezSo && cena.repete;
    let inicio = 0;
    let id = 0;

    // O relógio NUNCA é zerado: o laço é decidido dentro de `quadro`, camada a
    // camada. Reiniciá-lo aqui cortava quem repete para sempre no ponto em que
    // a cena reinicia, que não tem relação com o ciclo dela.
    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      const t = (agora - inicio) / 1000;
      if (!laco && t > total) {
        pintar(total);
        return;
      }
      pintar(t);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [cena, umaVezSo, paradoPorPreferencia]);

  if (!cena) return null;

  return (
    <div
      ref={palco}
      className={className}
      style={{
        position: "relative",
        width: largura,
        height: altura,
        containerType: "size",
        overflow: "hidden",
      }}
    >
      {cena.camadas.map((camada) => {
        if (!camada.visivel) return null;

        // O fundo cobre a cena inteira: se tem imagem, é ela; senão, a cor.
        if (camada.tipo === "cor") {
          return (
            <div
              key={camada.id}
              data-camada={camada.id}
              style={{
                position: "absolute",
                inset: 0,
                background: camada.src
                  ? `center / cover no-repeat url(${assetUrl(camada.src)})`
                  : camada.cor,
              }}
            />
          );
        }

        const comum = {
          "data-camada": camada.id,
          style: {
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: `${(camada.largura / ASTRO_VIEWBOX.w) * 100}%`,
            height: `${(camada.altura / ASTRO_VIEWBOX.h) * 100}%`,
            transformOrigin: "50% 50%",
            willChange: "transform, opacity",
          },
        };

        if (camada.tipo === "texto") {
          return (
            <div
              key={camada.id}
              {...comum}
              style={{
                ...comum.style,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                background: "#fff",
                color: "#0A2A52",
                borderRadius: "6cqw",
                fontWeight: 600,
                fontSize: "3cqw",
                padding: "0 2cqw",
              }}
            >
              {camada.texto}
            </div>
          );
        }

        return (
          // biome-ignore lint/performance/noImgElement: a cena posiciona a camada por transform, e o next/image envolveria cada uma num wrapper
          <img key={camada.id} src={assetUrl(camada.src)} alt="" {...comum} />
        );
      })}
    </div>
  );
}
