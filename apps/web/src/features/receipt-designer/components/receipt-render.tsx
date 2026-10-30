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
import { PAPER_MM } from "../lib/paper";
import { buildVariables, resolveVariables } from "../lib/variables";

const SIZE_PX: Record<BlockSize, number> = { sm: 11, md: 13, lg: 16 };

const FORMA_PAGAMENTO: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  DEBITO: "Cartão de débito",
  CREDITO: "Cartão de crédito",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  OUTROS: "Outros",
};

// Altura FIXA do logo (não max-height): reserva a caixa mesmo antes da imagem
// carregar, senão a altura medida para o @page sai curta e o cupom é cortado.
// Também impede que um logo alto coma a bobina inteira.
const LOGO_PX: Record<BlockSize, number> = { sm: 32, md: 48, lg: 64 };

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
              style={{ height: LOGO_PX[block.size] }}
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
                <span>{FORMA_PAGAMENTO[p.method] ?? p.method}</span>
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
        // Em mm, não px: a bobina é física. Com px o Chrome aplica a escala
        // "ajustar à área de impressão" e o cupom sai reduzido ou cortado.
        width: `${PAPER_MM[paper].content}mm`,
        maxWidth: "100%",
        margin: "0 auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#000",
        background: "#fff",
        padding: paper === "A4" ? 24 : "8px 0",
        lineHeight: 1.35,
      }}
    >
      {data.nfce && <CabecalhoNfce nfce={data.nfce} />}
      {blocks
        .filter((block) => !data.nfce || cabeNoDanfe(block, data))
        .map((block) => (
          <div key={block.id} className="mb-0.5">
            <BlockView block={block} data={data} vars={vars} />
          </div>
        ))}
      {data.nfce && <TotaisNfce nfce={data.nfce} data={data} />}
      {data.nfce && <BlocoNfce nfce={data.nfce} />}
    </div>
  );
}

// No DANFCe o emitente sai do cabeçalho legal (dados da nota), então o
// cabeçalho e o nome-no-lugar-do-logo do template duplicariam — e podiam
// mostrar um CNPJ diferente do emitente. O QR de NFC-e do template também
// sairia duas vezes: o legal vai junto da chave.
function cabeNoDanfe(block: ReceiptBlock, data: ReceiptSaleData): boolean {
  if (block.kind === "header") return false;
  if (block.kind === "logo") return Boolean(data.org.logoUrl);
  if (block.kind === "qr") return block.source !== "nfce";
  return true;
}

type Nfce = NonNullable<ReceiptSaleData["nfce"]>;

function CabecalhoNfce({ nfce }: { nfce: Nfce }) {
  const { emitente } = nfce;
  return (
    <div className="mb-1 text-center" style={{ fontSize: 11 }}>
      <div style={{ fontWeight: 700, fontSize: 12 }}>
        {emitente.razaoSocial}
      </div>
      <div>
        CNPJ: {emitente.cnpj} IE: {emitente.inscricaoEstadual}
      </div>
      <div>{emitente.endereco}</div>
      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
      <div style={{ fontWeight: 700 }}>
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      </div>
      {nfce.homologacao && (
        <div style={{ fontWeight: 700 }}>
          EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
        </div>
      )}
    </div>
  );
}

// Divisão III do DANFCe: o que o template de recibo pode não ter (quantidade
// de itens, valor a pagar) e a informação de tributos da Lei 12.741/2012.
function TotaisNfce({ nfce, data }: { nfce: Nfce; data: ReceiptSaleData }) {
  return (
    <div style={{ fontSize: 11 }}>
      <div className="flex justify-between">
        <span>Qtde. total de itens</span>
        <span>{data.items.length}</span>
      </div>
      <div className="flex justify-between font-bold">
        <span>Valor a pagar R$</span>
        <span>{currencyFormatter(data.total)}</span>
      </div>
      {nfce.tributosAproximados != null && (
        <div className="mt-1 text-center" style={{ fontSize: 10 }}>
          Tributos totais incidentes (Lei Federal 12.741/2012):{" "}
          {currencyFormatter(nfce.tributosAproximados)}
        </div>
      )}
    </div>
  );
}

// Conteúdo mínimo do DANFCe (Manual de Padrões da NFC-e): consulta pela chave,
// consumidor, número/série/emissão, protocolo e QR Code.
function BlocoNfce({ nfce }: { nfce: Nfce }) {
  const chave = nfce.chave.replace(/(\d{4})(?=\d)/g, "$1 ");
  const consumidor = nfce.consumidor
    ? `CONSUMIDOR ${nfce.consumidor.length === 11 ? "CPF" : "CNPJ"}: ${nfce.consumidor}`
    : "CONSUMIDOR NÃO IDENTIFICADO";
  return (
    <div className="mt-1 text-center" style={{ fontSize: 10 }}>
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ fontWeight: 700 }}>Consulte pela Chave de Acesso em</div>
      {nfce.consultaUrl && (
        <div style={{ wordBreak: "break-all" }}>{nfce.consultaUrl}</div>
      )}
      <div style={{ fontFamily: "inherit", letterSpacing: 0.3 }}>{chave}</div>
      <div style={{ marginTop: 4 }}>{consumidor}</div>
      <div style={{ marginTop: 4 }}>
        NFC-e nº {nfce.numero} Série {nfce.serie}{" "}
        {new Date(nfce.autorizadoEm).toLocaleString("pt-BR")}
      </div>
      <div>Protocolo de autorização: {nfce.protocolo}</div>
      <div style={{ display: "flex", justifyContent: "center", margin: 6 }}>
        <QRCodeSVG value={nfce.qrCodeUrl} size={120} level="M" />
      </div>
    </div>
  );
}
