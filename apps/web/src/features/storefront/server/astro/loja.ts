import "server-only";

import type { CatalogSettings } from "@/generated/prisma/client";
import prisma from "@/lib/db";

/**
 * A loja, do jeito que o Astro precisa conhecê-la.
 *
 * Tudo aqui sai do que a organização JÁ cadastrou no painel do catálogo: é
 * esse o "treinado com as informações da org". Nada é inventado no prompt, e
 * nada que não esteja publicado na vitrine entra — o visitante é anônimo, e o
 * que ele não veria navegando também não pode sair pela conversa.
 */
export type ContextoDaLoja = {
  nome: string;
  sobre: string;
  categorias: string[];
  produtos: number;
  mostraPrecos: boolean;
  aceitaPedidos: boolean;
  pagamentos: string[];
  entregas: string[];
  infoDeEntrega: string;
  frete: string;
  endereco: string;
  whatsapp: string;
  email: string;
};

const ROTULO_PAGAMENTO: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "cartão de crédito",
  DEBIT_CARD: "cartão de débito",
  CASH: "dinheiro",
  BANK_SLIP: "boleto",
  BANK_TRANSFER: "transferência",
  MEAL_VOUCHER: "vale-refeição",
  FOOD_VOUCHER: "vale-alimentação",
};

const ROTULO_ENTREGA: Record<string, string> = {
  DELIVERY: "entrega",
  PICKUP: "retirada na loja",
  SHIPPING: "envio por transportadora",
};

function rotular(valores: readonly string[], mapa: Record<string, string>) {
  return valores.map((valor) => mapa[valor] ?? valor.toLowerCase());
}

function descreverFrete(settings: CatalogSettings): string {
  if (settings.freightOptions === "NO_SHIPPING") return "";

  const partes: string[] = [];
  if (settings.freightChargeType === "FIXED") {
    partes.push(
      `frete fixo de R$ ${Number(settings.freightFixedValue).toFixed(2)}`,
    );
  } else {
    partes.push(
      `frete por peso, R$ ${Number(settings.freightValuePerKg).toFixed(2)} por kg`,
    );
  }
  if (settings.freeShippingEnabled) {
    partes.push(
      `frete grátis acima de R$ ${Number(settings.freeShippingMinValue).toFixed(2)}`,
    );
  }
  return partes.join("; ");
}

/** O endereço em uma linha, com o que estiver preenchido. */
function endereco(settings: CatalogSettings): string {
  return [settings.address, settings.number, settings.district, settings.cep]
    .filter(Boolean)
    .join(", ");
}

/**
 * Quantas categorias entram no prompt.
 *
 * O prompt vai inteiro em TODA mensagem da conversa: uma loja com trezentas
 * categorias pagaria o catálogo inteiro para responder "vocês têm arroz?". A
 * lista serve para ele saber onde procurar — o resto sai por tool.
 */
const MAX_CATEGORIAS = 40;

export async function montarContextoDaLoja(entrada: {
  organizationId: string;
  nome: string;
  settings: CatalogSettings;
}): Promise<ContextoDaLoja> {
  const { organizationId, settings } = entrada;

  const [categorias, produtos] = await Promise.all([
    prisma.category.findMany({
      where: { organizationId, isActive: true },
      select: { name: true },
      orderBy: { order: "asc" },
      take: MAX_CATEGORIAS,
    }),
    prisma.product.count({
      where: { organizationId, isActive: true, showInCatalog: true },
    }),
  ]);

  return {
    nome: settings.metaTitle || entrada.nome,
    sobre: (settings.aboutText ?? "").slice(0, 1200),
    categorias: categorias.map((categoria) => categoria.name),
    produtos,
    mostraPrecos: settings.showPrices,
    aceitaPedidos: settings.allowOrders,
    pagamentos: rotular(settings.paymentMethodSettings, ROTULO_PAGAMENTO),
    entregas: rotular(settings.deliveryMethods, ROTULO_ENTREGA),
    infoDeEntrega: (settings.deliverySpecialInfo ?? "").slice(0, 400),
    frete: descreverFrete(settings),
    endereco: endereco(settings),
    whatsapp: settings.showWhatsapp ? (settings.whatsappNumber ?? "") : "",
    email: settings.contactEmail ?? "",
  };
}
