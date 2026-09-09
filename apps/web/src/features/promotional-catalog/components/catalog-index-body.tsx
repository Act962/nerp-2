import type { CSSProperties } from "react";
import type { IndexRow } from "../lib/catalog-index";
import { indexLineHeight } from "../lib/catalog-index";

// Corpo da PÁGINA DE ÍNDICE — o sumário desenhado no lugar da grade.
//
// Vive fora do `catalog-preview.tsx` só por tamanho: aquele arquivo já passa de
// mil linhas. Continua sendo desenhado DENTRO do nó exportado, com o mesmo
// canvas 1080×pageH, então entra no PDF, no PNG e no link público de graça.
//
// Cada número de página carrega `data-index-target`: é por ele que o export
// acha o retângulo para virar link clicável no PDF, e que a página pública
// prende o clique que rola até a página. Mudar esse atributo quebra os dois.

interface CatalogIndexBodyProps {
  rows: IndexRow[];
  /** Cor do texto da página (mesma do título — contraste com o fundo). */
  color: string;
  columns: number;
  fontSize: number;
  fontFamily?: string;
  // Retângulo do grupo da página, quando o usuário moveu/redimensionou o
  // índice. Ausente = o índice ocupa o miolo da página, como o grid faria.
  boxStyle?: CSSProperties;
  // Presente = o número vira BOTÃO e leva à página (link público/editor).
  // Ausente = texto puro, que é o que o PDF e o PNG precisam.
  onNavigate?: (pageNumber: number) => void;
}

export function CatalogIndexBody({
  rows,
  color,
  columns,
  fontSize,
  fontFamily,
  boxStyle,
  onNavigate,
}: CatalogIndexBodyProps) {
  const lineHeight = indexLineHeight(fontSize);

  if (rows.length === 0) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-center"
        style={{ color, opacity: 0.5, fontSize: 18 }}
      >
        O índice aparece aqui quando o catálogo tiver produtos.
      </div>
    );
  }

  return (
    <div
      // O MESMO papel do grupo de produtos numa página comum: é o bloco de
      // conteúdo da página. Marcar assim faz a camada de seleção já existente
      // desenhar a moldura e dar as alças de mover e redimensionar, sem UI
      // nova — numa página de índice não há produto disputando o lugar.
      data-role="product-group"
      className={boxStyle ? undefined : "min-h-0 flex-1"}
      // Colunas de jornal: as linhas descem e viram para a coluna seguinte, que
      // é como um sumário se lê. `break-inside-avoid` impede uma linha de ser
      // partida no pé da coluna.
      style={{
        ...boxStyle,
        columnCount: columns,
        columnGap: 40,
        color,
        fontFamily,
      }}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline gap-2 break-inside-avoid"
          style={{ fontSize, lineHeight: `${lineHeight}px` }}
        >
          <span className="truncate">{row.label}</span>
          {/* Guia pontilhada: liga o nome ao número sem depender de alinhamento
              por tabulação, que não existe no canvas. */}
          <span
            className="min-w-0 flex-1 self-end border-b border-dotted"
            style={{
              borderColor: color,
              opacity: 0.35,
              marginBottom: Math.round(fontSize / 3),
            }}
          />
          <span className="flex shrink-0 gap-1.5 font-semibold tabular-nums">
            {row.pages.map((n) =>
              onNavigate ? (
                // Botão de verdade, não `div` com clique: teclado funciona de
                // graça. Sem estilo de link — no PDF e no PNG o número tem que
                // continuar sendo só um número.
                <button
                  key={n}
                  type="button"
                  data-index-target={n}
                  className="cursor-pointer font-semibold underline-offset-2 hover:underline"
                  style={{ color }}
                  onClick={() => onNavigate(n)}
                >
                  {n}
                </button>
              ) : (
                <span key={n} data-index-target={n}>
                  {n}
                </span>
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
