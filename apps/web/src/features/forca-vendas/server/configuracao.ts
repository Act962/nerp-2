import "server-only";

import prisma from "@/lib/db";
import type { PoliticaComercial } from "../lib/regras-pedido";

/** Política da organização, criada com os padrões na primeira leitura. */
export async function obterConfiguracao(organizationId: string) {
  const config = await prisma.configuracaoForcaVendas.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  return {
    id: config.id,
    descontoLivrePercent: Number(config.descontoLivrePercent),
    descontoMaximoPercent: Number(config.descontoMaximoPercent),
    flexCreditoPercent: Number(config.flexCreditoPercent),
    flexLimiteNegativo: Number(config.flexLimiteNegativo),
    autoAprovar: config.autoAprovar,
    bloquearInadimplente: config.bloquearInadimplente,
    raioCheckinMetros: config.raioCheckinMetros,
    retencaoLocalizacaoDias: config.retencaoLocalizacaoDias,
    destinoPedido: config.destinoPedido,
  };
}

export type ConfiguracaoFv = Awaited<ReturnType<typeof obterConfiguracao>>;

/** Perfil do vendedor no módulo, criado na primeira vez que ele precisa. */
export async function garantirPerfil(organizationId: string, memberId: string) {
  return prisma.vendedorPerfil.upsert({
    where: { memberId },
    create: { organizationId, memberId },
    update: {},
  });
}

/** A política que vale para este vendedor: o limite dele, quando existe, vence o da org. */
export function politicaDoVendedor(
  config: ConfiguracaoFv,
  perfil: {
    descontoMaximoPercent: unknown;
    flexLimiteNegativo: unknown;
  } | null,
): PoliticaComercial {
  return {
    descontoLivrePercent: config.descontoLivrePercent,
    descontoMaximoPercent:
      perfil?.descontoMaximoPercent != null
        ? Number(perfil.descontoMaximoPercent)
        : config.descontoMaximoPercent,
    flexCreditoPercent: config.flexCreditoPercent,
    flexLimiteNegativo:
      perfil?.flexLimiteNegativo != null
        ? Number(perfil.flexLimiteNegativo)
        : config.flexLimiteNegativo,
  };
}
