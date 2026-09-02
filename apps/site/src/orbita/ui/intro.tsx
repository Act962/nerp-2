"use client";

import { useEffect, useRef } from "react";
import { clamp, smoothstep } from "../lib/cn";
import { scroll } from "../lib/store";
import { BRAND, SYMBOL } from "./brand";

/**
 * Abertura: a cortina azul.
 *
 * A página começa preenchida com o azul da marca e o símbolo oficial desenhado
 * grande no centro. Rolar levanta essa cortina como uma persiana, e o espaço
 * aparece por baixo — o planeta já estava lá o tempo todo.
 *
 * O símbolo não some: ele é entregue à cena. Suas duas metades convergem para
 * dois objetos reais, cada uma para o seu:
 *
 * - **o arco** vai para o planeta — o raio interno pousa exatamente sobre a
 *   silhueta do globo, e o que era o anel da marca vira a órbita da Terra;
 * - **a esfera** vai para a esfera 3D — mesma posição, mesmo raio, e então a
 *   chapada some e a de verdade continua o percurso.
 *
 * Nenhuma das duas coordenadas é chutada: a cena publica a projeção do planeta
 * (`scroll.globe`) e da esfera (`scroll.orb`) em pixels a cada frame, e é para
 * lá que as peças voam. Por isso a emenda fecha em qualquer tela, distância de
 * câmera ou fov.
 *
 * O arco vive *dentro* da cortina e é recortado pela borda que sobe — é a
 * marca impressa no fundo. A esfera vive por cima, já no espaço.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const curtain = useRef<HTMLDivElement>(null);
  const arc = useRef<HTMLImageElement>(null);
  const orb = useRef<HTMLDivElement>(null);

  /*
    O raio que o CSS manda, em pixels.

    Medido do elemento: apaga-se o `width` inline (que o loop escreve) para o
    valor do CSS voltar a valer, lê-se, e devolve-se o inline. Uma vez na
    montagem e a cada redimensionamento — é uma leitura de layout, e não pode
    acontecer dentro do frame.
  */
  const raioInicial = useRef(0);

  useEffect(() => {
    const medirRaio = () => {
      const el = arc.current;
      if (!el) return;
      const inline = el.style.width;
      el.style.width = "";
      const medido = el.clientWidth / 2;
      el.style.width = inline;
      if (medido > 0) raioInicial.current = medido;
    };

    medirRaio();
    window.addEventListener("resize", medirRaio);
    return () => window.removeEventListener("resize", medirRaio);
  }, []);

  useEffect(() => {
    let raf = 0;
    let finished = false;
    // As variáveis de cor moram no palco: é o ancestral comum do overlay e da
    // navegação, e é a navegação que precisa saber sobre que fundo ela está.
    const stage = root.current?.closest<HTMLElement>(".orbita-stage") ?? null;

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const host = root.current;
      if (!host) return;

      const t = clamp(scroll.intro);
      const eased = smoothstep(t);

      const done = t >= 0.999;
      if (done !== finished) {
        finished = done;
        host.dataset.done = done ? "true" : "false";
      }
      if (done) return;

      const w = host.clientWidth;
      const h = host.clientHeight;

      /* --- a cortina: a borda sobe --- */
      if (curtain.current) {
        curtain.current.style.height = `${((1 - eased) * 100).toFixed(3)}%`;
      }

      /*
        Tamanho de partida do símbolo — medido, não parseado.

        O CSS define o raio numa variável (`--o-intro-r: min(30svh, 38vw)`), e
        a tentação é ler a variável e converter para número. Não funciona:
        `getComputedStyle` devolve custom property como TEXTO NÃO RESOLVIDO —
        a string "min(30svh, 38vw)" —, e `parseFloat` disso é NaN. O símbolo
        caía no reserva `altura * 0.38`, que no celular dá um diâmetro maior
        que a tela: o arco saía pelas bordas e a esfera cobria metade do azul.

        A medida certa vem do próprio elemento, que o CSS já dimensiona. Ela é
        tirada uma vez por tamanho de tela (ver `medirRaio`), e não a cada
        frame, porque ler `clientWidth` obriga o navegador a recalcular layout.
      */
      // O reserva também respeita a largura: um raio tirado só da altura
      // estoura a tela no retrato, que foi exatamente o defeito de origem.
      const startOuter = raioInicial.current || Math.min(h * 0.3, w * 0.38);
      const startCx = w * 0.48;
      const startCy = h * 0.52;

      /* --- arco → planeta --- */
      if (arc.current) {
        // Encaixe: o raio interno do arco pousa na silhueta do planeta, e o
        // anel da marca passa a envolver o globo como uma órbita.
        const targetOuter = scroll.globe.ready
          ? scroll.globe.r / SYMBOL.innerRatio
          : startOuter;
        const targetCx = scroll.globe.ready ? scroll.globe.x : startCx;
        const targetCy = scroll.globe.ready ? scroll.globe.y : startCy;

        /*
          O encaixe acontece antes do meio do caminho.

          Se o arco convergisse no mesmo ritmo da cortina, o anel só alcançaria
          o planeta quando o azul já tivesse passado por cima dele. Chegando
          cedo, ele fica um bom tempo abraçando o globo enquanto a revelação
          continua — que é o momento que a transição existe para mostrar.
        */
        const landing = smoothstep(clamp(t / 0.5));
        const outer = startOuter + (targetOuter - startOuter) * landing;
        const cx = startCx + (targetCx - startCx) * landing;
        const cy = startCy + (targetCy - startCy) * landing;

        const style = arc.current.style;
        style.width = `${(outer * 2).toFixed(1)}px`;
        style.height = `${(outer * 2).toFixed(1)}px`;
        style.transform = `translate3d(${(cx - outer).toFixed(1)}px, ${(cy - outer).toFixed(1)}px, 0)`;
      }

      /* --- esfera → esfera 3D --- */
      if (orb.current) {
        const startX =
          startCx +
          Math.cos(SYMBOL.sphereAngle) * SYMBOL.sphereDistance * startOuter;
        const startY =
          startCy -
          Math.sin(SYMBOL.sphereAngle) * SYMBOL.sphereDistance * startOuter;
        const startR = startOuter * SYMBOL.sphereRadius;

        const target = scroll.orb.ready
          ? scroll.orb
          : { x: startX, y: startY, r: startR };

        // A esfera se solta depois que o azul começa a subir e pousa antes do
        // fim: os últimos 10% são só a troca pela esfera de verdade, com as
        // duas exatamente na mesma posição e no mesmo tamanho.
        const flight = smoothstep(clamp((t - 0.1) / 0.8));
        const x = startX + (target.x - startX) * flight;
        const y = startY + (target.y - startY) * flight;
        const r = startR + (target.r * 1.06 - startR) * flight;

        const style = orb.current.style;
        style.width = `${(r * 2).toFixed(1)}px`;
        style.height = `${(r * 2).toFixed(1)}px`;
        style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
        style.opacity = (1 - smoothstep(clamp((t - 0.92) / 0.08))).toFixed(3);
        style.setProperty(
          "--o-intro-hint",
          smoothstep(clamp(t / 0.1)).toFixed(3),
        );
      }

      // O escurecimento sob a navegação só entra quando o azul sai de baixo dela.
      stage?.style.setProperty("--o-nav-scrim", eased.toFixed(3));
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="o-intro" ref={root} data-done="false" aria-hidden="true">
      <div className="o-intro__curtain" ref={curtain}>
        <div className="o-intro__frame">
          {/* biome-ignore lint/performance/noImgElement: asset estático e portátil */}
          <img
            className="o-intro__arc"
            ref={arc}
            src={BRAND.arcWhite}
            alt=""
            draggable={false}
          />
        </div>
      </div>

      <div className="o-intro__orb" ref={orb}>
        <span className="o-intro__hint">Deslize para baixo</span>
      </div>
    </div>
  );
}
