import {
  Ellipse,
  Image,
  Polygon,
  Rect,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  coverBackgroundToRgba,
  type CoverBackground,
  type CoverElement,
} from "../lib/cover-layout";
import {
  resolveVariables,
  type BookVariableValues,
} from "../lib/book-variables";

// Renderização em PDF de um layout de capa — ÚNICA implementação, usada tanto
// pelo Book quanto pelo catálogo de PDV.
//
// Existiam duas: o catálogo mantinha uma réplica reduzida que ignorava formas,
// fontes e rotação em silêncio, então uma capa montada no editor saía diferente
// no PDF. Um editor só de canvas Konva não tem como avisar o usuário disso — a
// única defesa é os dois documentos passarem pelo mesmo renderizador.

// Elemento de capa já resolvido pra renderização: `imageKey` (quando
// type === "image") contém a URL completa, não a key do R2 — resolução feita
// antes de montar os dados do documento.
export type ResolvedCoverElement = CoverElement;

// URL simples (foto sem ajuste de enquadramento) ou o buffer já cortado
// (pan/zoom aplicado via sharp) — react-pdf aceita os dois como `src`.
export type PhotoSource = string | { data: Buffer; format: "jpg" };

// Fundo atrás de uma foto "caber inteira" no PDF. O desfoque não existe em
// react-pdf, então o buffer já vem borrado do sharp; a cor é pintada num View.
export type PhotoBackdropSource =
  | { type: "color"; color: string }
  | { type: "blur"; source: PhotoSource };

/**
 * Rotação do elemento, no mesmo referencial do editor.
 *
 * O Konva gira em torno do (x, y) do nó, que aqui é o canto superior esquerdo
 * da caixa; o padrão do react-pdf é o centro. Sem fixar a origem, um elemento
 * girado assenta em outro lugar no PDF.
 */
function rotationStyle(rotation: number) {
  if (!rotation) return null;
  return { transform: `rotate(${rotation}deg)`, transformOrigin: "0 0" };
}

// react-pdf não tem triângulo nem elipse como primitiva de layout: as formas
// são desenhadas em SVG por cima da caixa e o texto vai numa <Text> centrada.
function ShapeElementView({
  element,
  text,
}: {
  element: Extract<ResolvedCoverElement, { type: "shape" }>;
  text: string;
}) {
  const stroke = element.strokeWidth > 0 ? element.strokeColor : undefined;
  const inset = element.strokeWidth / 2;
  const fillProps = {
    fill: element.fill,
    fillOpacity: element.fillOpacity,
    stroke,
    strokeWidth: element.strokeWidth,
  };

  return (
    <View
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...rotationStyle(element.rotation),
      }}
    >
      <Svg
        style={{ position: "absolute", left: 0, top: 0 }}
        width={element.width}
        height={element.height}
        viewBox={`0 0 ${element.width} ${element.height}`}
      >
        {element.shape === "circle" ? (
          <Ellipse
            cx={element.width / 2}
            cy={element.height / 2}
            rx={Math.max(0, element.width / 2 - inset)}
            ry={Math.max(0, element.height / 2 - inset)}
            {...fillProps}
          />
        ) : element.shape === "triangle" ? (
          <Polygon
            points={`${element.width / 2},${inset} ${element.width - inset},${element.height - inset} ${inset},${element.height - inset}`}
            {...fillProps}
          />
        ) : (
          <Rect
            x={inset}
            y={inset}
            width={Math.max(0, element.width - element.strokeWidth)}
            height={Math.max(0, element.height - element.strokeWidth)}
            rx={element.shape === "rounded" ? 16 : 0}
            {...fillProps}
          />
        )}
      </Svg>
      {!!text && (
        <Text
          style={{
            fontSize: element.fontSize,
            color: element.fontColor,
            fontFamily: element.fontFamily ?? "Helvetica",
            fontWeight: element.fontWeight === "bold" ? "bold" : "normal",
            textAlign: "center",
            paddingHorizontal: 8,
          }}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

export function CoverLayoutView({
  elements,
  background,
  variableValues,
  photoSources,
  photoBackdrops,
}: {
  elements: ResolvedCoverElement[];
  background?: CoverBackground | null;
  /**
   * Valores das variáveis ({{loja}}, {{periodo}}…). Ausente = documento sem
   * variáveis (o catálogo): o texto sai literal. Resolver com um mapa vazio
   * apagaria qualquer "{{...}}" digitado à mão.
   */
  variableValues?: BookVariableValues;
  photoSources?: PhotoSource[];
  photoBackdrops?: Array<PhotoBackdropSource | undefined>;
}) {
  const resolveText = (text: string) =>
    variableValues ? resolveVariables(text, variableValues) : text;

  return (
    <View
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: background?.imageKey
          ? "#ffffff"
          : background
            ? coverBackgroundToRgba(background)
            : "#ffffff",
      }}
    >
      {background?.imageKey && (
        <Image
          src={background.imageKey}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {background?.imageKey && (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            backgroundColor: coverBackgroundToRgba(background),
          }}
        />
      )}
      {elements.map((element) => {
        const boxStyle = {
          position: "absolute" as const,
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          ...rotationStyle(element.rotation),
        };

        if (element.type === "text") {
          const resolved = resolveText(element.text);
          return (
            <Text
              key={element.id}
              style={{
                ...boxStyle,
                fontSize: element.fontSize,
                color: element.color,
                fontFamily: element.fontFamily ?? "Helvetica",
                fontWeight: element.fontWeight === "bold" ? "bold" : "normal",
                textAlign: element.align,
              }}
            >
              {element.uppercase ? resolved.toUpperCase() : resolved}
            </Text>
          );
        }

        if (element.type === "shape") {
          return (
            <ShapeElementView
              key={element.id}
              element={element}
              text={resolveText(element.text)}
            />
          );
        }

        if (element.type === "photoSlot") {
          const source = photoSources?.[element.slotIndex];
          if (!source) return null;
          const backdrop = photoBackdrops?.[element.slotIndex];
          const strokeWidth = element.strokeWidth ?? 0;
          const scale = element.imageScale ?? 1;
          // Moldura como View com overflow hidden: o zoom estoura as bordas da
          // foto de propósito, e sem o recorte ela invadiria os elementos
          // vizinhos da página.
          return (
            <View
              key={element.id}
              style={{
                ...boxStyle,
                borderRadius: element.cornerRadius,
                overflow: "hidden",
                ...(strokeWidth > 0
                  ? {
                      borderWidth: strokeWidth,
                      borderColor: element.strokeColor ?? "#1a1a1a",
                      borderStyle: element.strokeDashed
                        ? ("dashed" as const)
                        : ("solid" as const),
                    }
                  : {}),
              }}
            >
              {backdrop?.type === "color" && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: backdrop.color,
                  }}
                />
              )}
              {backdrop?.type === "blur" && (
                <Image
                  src={backdrop.source}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}
              <Image
                src={source}
                style={{
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  marginLeft: `${(1 - scale) * (element.imageOffsetX ?? 50)}%`,
                  marginTop: `${(1 - scale) * (element.imageOffsetY ?? 50)}%`,
                  objectFit: element.objectFit,
                  objectPositionX: `${element.imageOffsetX ?? 50}%`,
                  objectPositionY: `${element.imageOffsetY ?? 50}%`,
                }}
              />
            </View>
          );
        }

        if (element.type === "divider") {
          return (
            <View
              key={element.id}
              style={{ ...boxStyle, backgroundColor: element.color }}
            />
          );
        }

        if (!element.imageKey) return null;
        return (
          <Image
            key={element.id}
            src={element.imageKey}
            style={{ ...boxStyle, objectFit: element.objectFit }}
          />
        );
      })}
    </View>
  );
}
