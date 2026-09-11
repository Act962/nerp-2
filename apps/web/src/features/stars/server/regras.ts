import "server-only";

import { ACOES_COBRAVEIS } from "@/features/stars/lib/acoes";
import { arredondarEstrelas, emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";

/**
 * O preço de cada ação cobrável, de uma organização.
 *
 * Mora aqui, e não dentro de uma procedure, porque quem edita esses preços
 * passou a ser o administrador da PLATAFORMA (`/site/stars`), enquanto a
 * organização continua só lendo. São duas guardas diferentes chamando a mesma
 * regra — e duas cópias dela dariam, mais cedo ou mais tarde, dois preços para
 * a mesma ação.
 */

export type RegraDeAcao = {
  actionKey: string;
  label: string;
  descricao: string;
  stars: number;
  isActive: boolean;
};

/**
 * Devolve **todas** as ações do catálogo, com ou sem regra gravada: uma tela
 * que só lista o que já existe não deixa cadastrar o primeiro preço, e o
 * primeiro preço é justamente o que liga a cobrança.
 */
export async function lerRegras(
  organizationId: string,
): Promise<RegraDeAcao[]> {
  const gravadas = await prisma.starRule.findMany({
    where: { organizationId },
    select: { actionKey: true, stars: true, isActive: true },
  });
  const porChave = new Map(gravadas.map((regra) => [regra.actionKey, regra]));

  return ACOES_COBRAVEIS.map((acao) => {
    const gravada = porChave.get(acao.actionKey);
    return {
      actionKey: acao.actionKey,
      label: acao.label,
      descricao: acao.descricao,
      stars: emEstrelas(gravada?.stars),
      isActive: gravada?.isActive ?? true,
    };
  });
}

/** Nenhuma ação com preço = nada é cobrado nem bloqueado. */
export function cobrancaEstaAtiva(regras: readonly RegraDeAcao[]): boolean {
  return regras.some((regra) => regra.isActive && regra.stars > 0);
}

export class AcaoDesconhecidaError extends Error {
  constructor(actionKey: string) {
    super(`Ação desconhecida: ${actionKey}`);
    this.name = "AcaoDesconhecidaError";
  }
}

/**
 * Grava o preço de uma ação. Zero desliga a cobrança dela.
 *
 * Preço zero é a forma de desligar de novo, e é o valor de quem nunca
 * cadastrou: um único caminho para "não cobra esta ação", em vez de "não tem
 * linha" e "tem linha valendo zero" significando a mesma coisa por dois
 * caminhos diferentes.
 */
export async function gravarRegra(entrada: {
  organizationId: string;
  actionKey: string;
  stars: number;
}): Promise<{ actionKey: string; stars: number; cobrancaAtiva: boolean }> {
  // A chave vem do cliente e precisa existir no catálogo: sem esta conferência
  // dava para gravar preço para uma ação que ninguém cobra — uma linha órfã
  // que só aparece confundindo quem for auditar a fatura.
  const acao = ACOES_COBRAVEIS.find(
    (item) => item.actionKey === entrada.actionKey,
  );
  if (!acao) throw new AcaoDesconhecidaError(entrada.actionKey);

  // Arredonda no servidor, e não confia no que o cliente mandou: a coluna tem
  // duas casas, e gravar 0,239 sairia truncado sem ninguém avisar.
  const stars = arredondarEstrelas(entrada.stars);

  await prisma.starRule.upsert({
    where: {
      organizationId_actionKey: {
        organizationId: entrada.organizationId,
        actionKey: acao.actionKey,
      },
    },
    create: {
      organizationId: entrada.organizationId,
      actionKey: acao.actionKey,
      label: acao.label,
      stars,
    },
    update: { stars, label: acao.label, isActive: true },
  });

  const comPreco = await prisma.starRule.count({
    where: {
      organizationId: entrada.organizationId,
      isActive: true,
      stars: { gt: 0 },
    },
  });

  return { actionKey: acao.actionKey, stars, cobrancaAtiva: comPreco > 0 };
}
