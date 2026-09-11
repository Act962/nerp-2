import { SaleStatus } from "@/generated/prisma/enums";

/**
 * O que conta como venda.
 *
 * Existiam três respostas no código: o Astro somava `COMPLETED` por
 * `completedAt`, os widgets somavam `CONFIRMED` por `createdAt`, e a listagem
 * de /vendas não filtrava status nenhum. Três números diferentes para "quanto
 * vendi hoje" é pior que um número errado — este arquivo é a resposta única.
 *
 * `DRAFT` e `PENDING_APPROVAL` ficam de fora porque ainda podem não virar
 * venda; `CANCELLED` porque deixou de ser. `PROCESSING` entra: a venda foi
 * fechada e está em separação.
 *
 * A data é `createdAt`, não `completedAt`: é quando a venda aconteceu no
 * balcão, e `completedAt` é nulo em tudo que ainda está em processamento.
 */
export const STATUS_VENDA_VALIDA = [
  SaleStatus.CONFIRMED,
  SaleStatus.PROCESSING,
  SaleStatus.COMPLETED,
] as const;

export type IntervaloDeDatas = { from: Date; to: Date };

export function whereVendaValida(
  organizationId: string,
  intervalo?: IntervaloDeDatas | null,
) {
  return { organizationId, ...whereVendaValidaGlobal(intervalo) };
}

/**
 * A mesma definição, SEM organização.
 *
 * Existe para um caso só: o painel do administrador da plataforma, que soma o
 * que passou por todas as empresas. Fora dali, use sempre `whereVendaValida`
 * com o id — consulta de venda sem `organizationId` num handler de cliente é
 * como vazamento entre organizações acontece.
 */
export function whereVendaValidaGlobal(intervalo?: IntervaloDeDatas | null) {
  return {
    status: { in: [...STATUS_VENDA_VALIDA] },
    ...(intervalo
      ? { createdAt: { gte: intervalo.from, lt: intervalo.to } }
      : {}),
  };
}
