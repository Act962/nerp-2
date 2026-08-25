"use client";

import { currencyFormatter } from "@/utils/currency-formatter";
import { QRCodeSVG } from "qrcode.react";
import type {
  BlockAlign,
  BlockSize,
  ReceiptBlock,
  ReceiptPaper,
  ReceiptSaleData,
} from "../lib/types";
import { buildVariables, resolveVariables } from "../lib/variables";

// Largura de "papel" em px para a tela/impressão (aprox. do físico a 96dpi).
const PAPER_WIDTH_PX: Record<ReceiptPaper, number> = {
  MM80: 288,
  MM58: 210,
  A4: 640,
};

const SIZE_PX: Record<BlockSize, number> = { sm: 11, md: 13, lg: 16 };

function alignClass(align: BlockAlign) {
  return align === "center"
    ? "text-center"
    : align === "right"
      ? "text-right"
      : "text-left";
}

function MultiLine({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas de texto estático
        <div key={i}>{line || " "}</div>
      ))}
    </>
  );
}

function qrValue(
  block: Extract<ReceiptBlock, { kind: "qr" }>,
  data: ReceiptSaleData,
  vars: Record<string, string>,
): string {
  if (block.source === "pix") return data.pixCode || "";
  if (block.source === "nfce") return data.nfceUrl || "";
  return resolveVariables(block.value, vars);
}

function BlockView({
  block,
  data,
  vars,
}: {
  block: ReceiptBlock;
  data: ReceiptSaleData;
  vars: Record<string, string>;
}) {
  switch (block.kind) {
    case "logo":
      return (
        <div className={alignClass(block.align)}>
          {data.org.logoUrl ? (
            // biome-ignore lint/performance/noImgElement: logo da org via URL
            <img
              src={data.org.logoUrl}
              alt={data.org.name}
              className="inline-block max-w-[60%] object-contain"
            />
          ) : (
            <div className="font-bold" style={{ fontSize: SIZE_PX.lg }}>
              {data.org.name}
            </div>
          )}
        </div>
      );
    case "header":
      return (
        <div
          className={alignClass(block.align)}
          style={{ fontSize: SIZE_PX.sm }}
        >
          {block.showName && (
            <div className="font-semibold" style={{ fontSize: SIZE_PX.md }}>
              {data.org.name}
            </div>
          )}
          {block.showDocument && data.org.document && (
            <div>CNPJ: {data.org.document}</div>
          )}
          {block.showAddress && data.org.address && (
            <div>{data.org.address}</div>
          )}
          {block.showPhone && data.org.phone && (
            <div>Tel: {data.org.phone}</div>
          )}
        </div>
      );
    case "text":
      return (
        <div
          className={alignClass(block.align)}
          style={{
            fontSize: SIZE_PX[block.size],
            fontWeight: block.bold ? 700 : 400,
          }}
        >
          <MultiLine text={resolveVariables(block.value, vars)} />
        </div>
      );
    case "items":
      return (
        <div style={{ fontSize: SIZE_PX.sm }}>
          {data.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: itens estáticos da venda
            <div key={i} className="mb-0.5">
              <div className="flex justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="whitespace-nowrap">
                  {currencyFormatter(item.total)}
                </span>
              </div>
              <div className="text-muted-foreground">
                {block.showSku && item.sku ? `${item.sku} · ` : ""}
                {item.quantity} ×{" "}
                {block.showUnitPrice ? currencyFormatter(item.unitPrice) : ""}
              </div>
            </div>
          ))}
        </div>
      );
    case "totals":
      return (
        <div style={{ fontSize: SIZE_PX.sm }}>
          {block.showSubtotal && (
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currencyFormatter(data.subtotal)}</span>
            </div>
          )}
          {block.showDiscount && data.discount > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>- {currencyFormatter(data.discount)}</span>
            </div>
          )}
          <div
            className="flex justify-between font-bold"
            style={{ fontSize: SIZE_PX.md }}
          >
            <span>Total</span>
            <span>{currencyFormatter(data.total)}</span>
          </div>
          {block.showPayments &&
            data.payments.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pagamentos estáticos
              <div key={i} className="flex justify-between">
                <span>{p.method}</span>
                <span>{currencyFormatter(p.amount)}</span>
              </div>
            ))}
          {block.showChange && (data.change ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Troco</span>
              <span>{currencyFormatter(data.change ?? 0)}</span>
            </div>
          )}
        </div>
      );
    case "qr": {
      const value = qrValue(block, data, vars);
      const px = block.size === "lg" ? 128 : block.size === "md" ? 96 : 64;
      return (
        <div className="flex flex-col items-center gap-1 py-1">
          {value ? (
            <div className="bg-white p-1">
              <QRCodeSVG value={value} size={px} />
            </div>
          ) : (
            <div
              className="text-muted-foreground"
              style={{ fontSize: SIZE_PX.sm }}
            >
              [QR sem conteúdo]
            </div>
          )}
          {block.caption && (
            <div className="text-center" style={{ fontSize: SIZE_PX.sm }}>
              {resolveVariables(block.caption, vars)}
            </div>
          )}
        </div>
      );
    }
    case "link":
      return (
        <div className="text-center" style={{ fontSize: SIZE_PX.sm }}>
          <div className="font-medium">
            {resolveVariables(block.label, vars)}
          </div>
          <div className="break-all text-muted-foreground">{block.url}</div>
        </div>
      );
    case "divider":
      return (
        <div
          className="my-1"
          style={{
            borderTop: `1px ${block.style === "dashed" ? "dashed" : "solid"} currentColor`,
            opacity: 0.6,
          }}
        />
      );
    case "spacer":
      return <div style={{ height: SIZE_PX.md }} />;
    default:
      return null;
  }
}

export function ReceiptRender({
  blocks,
  data,
  paper,
  className,
}: {
  blocks: ReceiptBlock[];
  data: ReceiptSaleData;
  paper: ReceiptPaper;
  className?: string;
}) {
  const vars = buildVariables(data);
  return (
    <div
      className={className}
      style={{
        width: PAPER_WIDTH_PX[paper],
        maxWidth: "100%",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#000",
        background: "#fff",
        padding: paper === "A4" ? 24 : 12,
        lineHeight: 1.35,
      }}
    >
      {blocks.map((block) => (
        <div key={block.id} className="mb-0.5">
          <BlockView block={block} data={data} vars={vars} />
        </div>
      ))}
    </div>
  );
}
