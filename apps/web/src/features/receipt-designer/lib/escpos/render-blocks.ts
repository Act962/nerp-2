import { currencyFormatter } from "@/utils/currency-formatter";
import type { ReceiptBlock, ReceiptPaper, ReceiptSaleData } from "../types";
import { buildVariables, resolveVariables } from "../variables";
import { PAPER_COLS } from "./cols";
import {
  CODEPAGE_COMMAND,
  CUT,
  INIT,
  LF,
  align,
  bold,
  feed,
  qrCode,
  size,
} from "./commands";
import { type Codepage, encodeText } from "./encoding";
import { alignLine, repeat, truncate, twoCols, wrap } from "./layout";

export type EscposOptions = {
  codepage?: Codepage;
  /** Impressora com guilhotina. A maioria das 58mm Bluetooth não tem. */
  cut?: boolean;
  /** Algumas genéricas ignoram GS ( k; aí o QR sai como texto. */
  qrSupported?: boolean;
  /** Linhas em branco no fim: a guilhotina fica acima da cabeça de impressão. */
  feedLines?: number;
  /** Sobrepõe a largura em colunas quando o aparelho foge do padrão. */
  cols?: number;
};

/**
 * Converte os blocos do editor de cupom em bytes ESC/POS.
 *
 * É o SEGUNDO renderer do mesmo template: `receipt-render.tsx` desenha para a
 * tela e para a impressão por CSS, este desenha para a térmica. Por isso as
 * variáveis passam por `buildVariables`/`resolveVariables` — os dois precisam
 * resolver `{{total}}` exatamente igual, senão o dono calibra numa e imprime
 * outra.
 *
 * Função pura: sem DOM, sem async, sem rede. É o que a torna testável byte a
 * byte, que é a única forma decente de verificar impressão sem impressora.
 */
export function blocksToEscpos(
  blocks: ReceiptBlock[],
  data: ReceiptSaleData,
  paper: ReceiptPaper,
  options: EscposOptions = {},
): Uint8Array {
  const codepage = options.codepage ?? "CP860";
  const cols = options.cols ?? PAPER_COLS[paper];
  const vars = buildVariables(data);
  const out: number[] = [];

  const text = (value: string) => out.push(...encodeText(value, codepage));
  const line = (value = "") => {
    text(value);
    out.push(LF);
  };

  out.push(...INIT, ...CODEPAGE_COMMAND[codepage]);

  for (const block of blocks) {
    switch (block.kind) {
      case "logo": {
        // Sem raster nesta fase: converter imagem em bitmap de 1 bit arrasta
        // canvas para dentro de uma função pura e dobra o escopo. O nome da
        // loja em corpo dobrado cumpre o papel de identificar o cupom.
        if (!data.org.name) break;
        out.push(...align("center"), ...size(2, 2), ...bold(true));
        line(truncate(data.org.name, Math.floor(cols / 2)));
        out.push(...bold(false), ...size(1, 1), ...align("left"));
        break;
      }

      case "header": {
        out.push(...align(block.align));
        if (block.showName && data.org.name) {
          out.push(...bold(true));
          line(alignLine(data.org.name, cols, block.align));
          out.push(...bold(false));
        }
        if (block.showDocument && data.org.document) {
          line(alignLine(`CNPJ ${data.org.document}`, cols, block.align));
        }
        if (block.showAddress && data.org.address) {
          for (const l of wrap(data.org.address, cols)) {
            line(alignLine(l, cols, block.align));
          }
        }
        if (block.showPhone && data.org.phone) {
          line(alignLine(data.org.phone, cols, block.align));
        }
        out.push(...align("left"));
        break;
      }

      case "text": {
        const resolved = resolveVariables(block.value, vars);
        // Corpo dobrado ocupa duas colunas por caractere: a linha cabe pela
        // metade, senão a impressora quebra no meio da palavra.
        const dobrado = block.size === "lg";
        const largura = dobrado ? Math.floor(cols / 2) : cols;
        if (dobrado) out.push(...size(2, 2));
        if (block.bold) out.push(...bold(true));
        out.push(...align(block.align));
        for (const l of wrap(resolved, largura)) {
          line(alignLine(l, largura, block.align));
        }
        out.push(...align("left"));
        if (block.bold) out.push(...bold(false));
        if (dobrado) out.push(...size(1, 1));
        break;
      }

      case "items": {
        for (const item of data.items) {
          line(twoCols(item.name, currencyFormatter(item.total), cols));

          const detalhe = [
            block.showSku && item.sku ? item.sku : null,
            block.showUnitPrice
              ? `${item.quantity} x ${currencyFormatter(item.unitPrice)}`
              : `${item.quantity} un`,
          ]
            .filter(Boolean)
            .join(" · ");
          if (detalhe) line(`  ${truncate(detalhe, cols - 2)}`);

          // A observação é o que a cozinha realmente lê. Em negrito e sempre
          // que houver texto — nunca atrás de uma opção do bloco, porque o
          // template é JSON persistido e nunca migrado.
          if (item.notes) {
            out.push(...bold(true));
            for (const l of wrap(`>> ${item.notes}`, cols - 2)) line(`  ${l}`);
            out.push(...bold(false));
          }
        }
        break;
      }

      case "totals": {
        if (block.showSubtotal) {
          line(twoCols("Subtotal", currencyFormatter(data.subtotal), cols));
        }
        if (block.showDiscount && data.discount > 0) {
          line(
            twoCols("Desconto", `-${currencyFormatter(data.discount)}`, cols),
          );
        }
        out.push(...bold(true));
        line(twoCols("TOTAL", currencyFormatter(data.total), cols));
        out.push(...bold(false));
        if (block.showPayments) {
          for (const payment of data.payments) {
            line(
              twoCols(payment.method, currencyFormatter(payment.amount), cols),
            );
          }
        }
        if (block.showChange && data.change != null && data.change > 0) {
          line(twoCols("Troco", currencyFormatter(data.change), cols));
        }
        break;
      }

      case "qr": {
        const value =
          block.source === "pix"
            ? (data.pixCode ?? "")
            : block.source === "nfce"
              ? (data.nfceUrl ?? "")
              : resolveVariables(block.value, vars);
        if (!value) break;

        out.push(...align("center"));
        if (options.qrSupported === false) {
          // Sem QR nativo, o endereço em texto ainda serve: o cliente digita.
          for (const l of wrap(value, cols)) line(alignLine(l, cols, "center"));
        } else {
          const modulo = block.size === "lg" ? 8 : block.size === "sm" ? 4 : 6;
          out.push(...qrCode(encodeText(value, codepage), modulo));
          out.push(LF);
        }
        if (block.caption) {
          const legenda = resolveVariables(block.caption, vars);
          for (const l of wrap(legenda, cols))
            line(alignLine(l, cols, "center"));
        }
        out.push(...align("left"));
        break;
      }

      case "link": {
        const label = resolveVariables(block.label, vars);
        const url = resolveVariables(block.url, vars);
        if (label) line(label);
        if (url) for (const l of wrap(url, cols)) line(l);
        break;
      }

      case "divider":
        line(repeat(block.style === "dashed" ? "-" : "=", cols));
        break;

      case "spacer":
        line();
        break;
    }
  }

  out.push(...feed(options.feedLines ?? 4));
  if (options.cut) out.push(...CUT);

  return Uint8Array.from(out);
}
