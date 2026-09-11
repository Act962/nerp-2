import type { AstroPricing } from "@/features/astro-consultor/server/preco";
import type { ModeloResolvido } from "@/features/astro-consultor/server/provider";

/**
 * O que toda tool do canal logado recebe.
 *
 * `organizationId` vem daqui e NUNCA de `inputSchema`. É a regra que segura o
 * isolamento entre organizações: sem o parâmetro, não existe mensagem, por
 * mais bem escrita que seja, capaz de fazer o modelo consultar a operação de
 * outra empresa. Todo id que chega por argumento é revalidado contra esta
 * organização antes de virar resposta.
 */
export type ContextoToolsApp = {
  organizationId: string;
  userId: string;
  sessaoId: string;
  /** A tabela de preços do site, para `estimarFaixaDePreco`. */
  tabelaPrecos: AstroPricing;
  /** As últimas falas da pessoa, para a busca de ferramentas. */
  falaDoVisitante: string;
  /**
   * Quem está atendendo esta conversa. Gerar imagem e buscar na web são tools
   * do PROVEDOR: existem no Google e não na OpenAI. Sem o modelo aqui, essas
   * duas simplesmente não entram no conjunto — melhor ausente do que presente
   * e quebrando na primeira chamada.
   */
  modelo?: ModeloResolvido;
};

/** Converte `Decimal` do Prisma no limite da resposta da tool. */
export function numero(
  valor: { toNumber(): number } | number | null | undefined,
): number {
  if (valor === null || valor === undefined) return 0;
  return typeof valor === "number" ? valor : valor.toNumber();
}

/** Dinheiro com duas casas, para o modelo não inventar centavos. */
export function dinheiro(
  valor: { toNumber(): number } | number | null | undefined,
): number {
  return Number(numero(valor).toFixed(2));
}
