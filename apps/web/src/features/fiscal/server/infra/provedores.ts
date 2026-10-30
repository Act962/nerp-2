import "server-only";

import {
  ErroFiscal,
  type ProvedorFiscal,
  type ProvedoresFiscais,
} from "@nerp/fiscal";
import { ProvedorFiscalSimulado } from "@nerp/fiscal/testes";
import prisma from "@/lib/db";
import { decryptString } from "@/lib/fiscal/encryption";
import { ProvedorFocus } from "./focus/provedor";

/**
 * Quem emite por cada organização. É o ÚNICO ponto que conhece os provedores
 * concretos: trocar a Focus por outro é um `case` novo aqui mais o adaptador.
 *
 * `FISCAL_PROVEDOR_SIMULADO=1` (só fora de produção) troca tudo pelo provedor
 * simulado — dá para testar o fluxo inteiro do PDV sem conta na Focus nem
 * certificado. O simulado guarda estado em memória: é um por processo — no
 * `globalThis`, porque em dev a rota do Inngest e a do oRPC podem carregar
 * cópias distintas deste módulo, e a nota emitida numa é cancelada na outra.
 */
const globalFiscal = globalThis as {
  nerpProvedorSimulado?: ProvedorFiscalSimulado;
};

export function provedorSimuladoAtivo(): boolean {
  return (
    process.env.FISCAL_PROVEDOR_SIMULADO === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

export class ProvedoresFiscaisDoBanco implements ProvedoresFiscais {
  async daOrganizacao(organizationId: string): Promise<ProvedorFiscal> {
    if (provedorSimuladoAtivo()) {
      globalFiscal.nerpProvedorSimulado ??= new ProvedorFiscalSimulado();
      return globalFiscal.nerpProvedorSimulado;
    }

    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId },
      select: {
        provider: true,
        environment: true,
        focusToken: true,
        focusTokenHomolog: true,
      },
    });
    if (!config)
      throw new ErroFiscal(
        "FISCAL_NAO_CONFIGURADO",
        "Configure a emissão fiscal em Integrações → Focus NFe",
      );

    switch (config.provider) {
      case "FOCUS_NFE": {
        const cifrado =
          config.environment === "PRODUCAO"
            ? config.focusToken
            : config.focusTokenHomolog;
        if (!cifrado)
          throw new ErroFiscal(
            "PROVEDOR_SEM_TOKEN",
            `Token da Focus de ${config.environment === "PRODUCAO" ? "produção" : "homologação"} não configurado`,
          );
        return new ProvedorFocus({
          token: decryptString(cifrado),
          ambiente: config.environment,
        });
      }
    }
  }
}
