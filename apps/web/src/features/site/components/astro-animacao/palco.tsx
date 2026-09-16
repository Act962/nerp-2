"use client";

import {
  ASTRO_VIEWBOX,
  type AstroCamada,
  type AstroEstado,
  escalaComEspelho,
} from "@nerp/site-content";
import type Konva from "konva";
import { useEffect, useRef } from "react";
import {
  Group,
  Image as KImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import { constructUrl } from "@/hooks/use-construct-url";

/**
 * O palco do editor.
 *
 * É Konva porque o editor precisa das alças de transformação — girar e
 * redimensionar arrastando — e, mais adiante, de `toDataURL` para exportar um
 * quadro. Já o mascote nas telas do site é DOM puro: lá não há nada para
 * agarrar, e `<img>` movido por `transform` a GPU compõe de graça.
 *
 * Os dois concordam porque perguntam a MESMA função (`estadoNoTempo`, em
 * `@nerp/site-content`) onde cada camada está no tempo.
 */

type Props = {
  camadas: AstroCamada[];
  /** o que desenhar agora — já resolvido por quem chama (tempo ou edição) */
  estados: Record<string, AstroEstado>;
  sel: string;
  /** alças escondidas enquanto a cena toca: mexer num alvo em movimento mente */
  tocando: boolean;
  escala: number;
  aoSelecionar: (id: string) => void;
  aoMover: (id: string, troca: Partial<AstroEstado>) => void;
};

export function Palco({
  camadas,
  estados,
  sel,
  tocando,
  escala,
  aoSelecionar,
  aoMover,
}: Props) {
  const nos = useRef(new Map<string, Konva.Node>());
  const transformer = useRef<Konva.Transformer>(null);

  const selecionada = camadas.find((c) => c.id === sel) ?? null;

  // A alça segue a seleção.
  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const no = nos.current.get(sel);
    tr.nodes(!no || tocando || selecionada?.travada ? [] : [no]);
    tr.getLayer()?.batchDraw();
  }, [sel, tocando, selecionada?.travada]);

  const guardarNo = (id: string) => (n: Konva.Node | null) => {
    if (n) nos.current.set(id, n);
    else nos.current.delete(id);
  };

  return (
    <Stage
      width={ASTRO_VIEWBOX.w * escala}
      height={ASTRO_VIEWBOX.h * escala}
      scaleX={escala}
      scaleY={escala}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) aoSelecionar("");
      }}
    >
      <Layer>
        {camadas.map((camada) => {
          if (!camada.visivel) return null;
          const estado = estados[camada.id] ?? camada.ini;

          // O fundo cobre a cena inteira: se tem imagem, é ela; senão, a cor.
          if (camada.tipo === "cor") {
            return camada.src ? (
              <FundoEmImagem key={camada.id} src={camada.src} />
            ) : (
              <Rect
                key={camada.id}
                x={0}
                y={0}
                width={ASTRO_VIEWBOX.w}
                height={ASTRO_VIEWBOX.h}
                fill={camada.cor}
                listening={false}
              />
            );
          }

          const comum = {
            camada,
            estado,
            aoSelecionar: () => aoSelecionar(camada.id),
            aoMover: (t: Partial<AstroEstado>) => aoMover(camada.id, t),
            refNo: guardarNo(camada.id),
          };

          return camada.tipo === "texto" ? (
            <Balao key={camada.id} {...comum} />
          ) : (
            <ImagemDaCamada key={camada.id} {...comum} />
          );
        })}

        <Transformer
          ref={transformer}
          rotateEnabled
          keepRatio
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          borderStroke="#2FC0FE"
          anchorStroke="#2FC0FE"
          anchorFill="#04101F"
          anchorSize={10}
        />
      </Layer>
    </Stage>
  );
}

/** O fundo em imagem, esticado na régua da cena e fora do alcance do mouse. */
function FundoEmImagem({ src }: { src: string }) {
  const [img] = useImage(constructUrl(src), "anonymous");
  if (!img) return null;
  return (
    <KImage
      image={img}
      x={0}
      y={0}
      width={ASTRO_VIEWBOX.w}
      height={ASTRO_VIEWBOX.h}
      listening={false}
    />
  );
}

type PecaProps = {
  camada: AstroCamada;
  estado: AstroEstado;
  aoSelecionar: () => void;
  aoMover: (e: Partial<AstroEstado>) => void;
  refNo: (n: Konva.Node | null) => void;
};

/**
 * Posição, giro e escala são gravados ARREDONDADOS: o arrasto produz frações
 * de pixel que ninguém vê e que enchem o JSON de ruído — e o campo do painel
 * mostraria `412.0000001`.
 *
 * A escala volta em MÓDULO: o sinal negativo no palco é o espelho da camada,
 * e gravá-lo no estado faria a alça de transformação desligar o espelho sem
 * ninguém ter pedido.
 */
function daTransformacao(n: Konva.Node): Partial<AstroEstado> {
  return {
    x: Math.round(n.x()),
    y: Math.round(n.y()),
    rot: Math.round(n.rotation()),
    esc: Number(Math.abs(n.scaleX()).toFixed(3)),
  };
}

function ImagemDaCamada({
  camada,
  estado,
  aoSelecionar,
  aoMover,
  refNo,
}: PecaProps) {
  // `anonymous` para o canvas não ficar marcado: uma peça vinda do bucket sem
  // isto impediria exportar um quadro.
  const [img] = useImage(constructUrl(camada.src), "anonymous");
  const escala = escalaComEspelho(camada, estado);
  if (!img) return null;

  return (
    <KImage
      ref={refNo}
      image={img}
      x={estado.x}
      y={estado.y}
      width={camada.largura}
      height={camada.altura}
      offsetX={camada.largura / 2}
      offsetY={camada.altura / 2}
      rotation={estado.rot}
      scaleX={escala.x}
      scaleY={escala.y}
      opacity={estado.op}
      draggable={!camada.travada}
      onMouseDown={aoSelecionar}
      onTap={aoSelecionar}
      onDragEnd={(ev) => aoMover(daTransformacao(ev.target))}
      onTransformEnd={(ev) => aoMover(daTransformacao(ev.target))}
    />
  );
}

/** O balão de fala, em Konva para poder ser arrastado como o resto da cena. */
function Balao({ camada, estado, aoSelecionar, aoMover, refNo }: PecaProps) {
  const escala = escalaComEspelho(camada, estado);
  return (
    <Group
      ref={refNo}
      x={estado.x}
      y={estado.y}
      offsetX={camada.largura / 2}
      offsetY={camada.altura / 2}
      rotation={estado.rot}
      scaleX={escala.x}
      scaleY={escala.y}
      opacity={estado.op}
      draggable={!camada.travada}
      onMouseDown={aoSelecionar}
      onTap={aoSelecionar}
      onDragEnd={(ev) => aoMover(daTransformacao(ev.target))}
      onTransformEnd={(ev) => aoMover(daTransformacao(ev.target))}
    >
      <Rect
        width={camada.largura}
        height={camada.altura}
        fill="#ffffff"
        cornerRadius={30}
      />
      {/* o bico, apontando para o mascote */}
      <Line
        points={[70, camada.altura, 50, camada.altura + 44, 116, camada.altura]}
        fill="#ffffff"
        closed
      />
      <Text
        text={camada.texto}
        width={camada.largura - 48}
        height={camada.altura}
        x={24}
        y={0}
        fontSize={36}
        fontStyle="600"
        fill="#0A2A52"
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
