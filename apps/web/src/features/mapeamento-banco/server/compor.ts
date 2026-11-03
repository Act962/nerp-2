import "server-only";
import { parseOracleConfig } from "@/features/erp-sync/server/connectors";
import prisma from "@/lib/db";
import { criarBancoOracle } from "../adapters/oracle/banco-oracle";
import { criarDestinoNoNerp } from "../adapters/prisma/destino-no-nerp";
import {
  criarConferenciaNoNerp,
  criarRepositorioNaConexao,
} from "../adapters/prisma/mapeamento-na-conexao";
import { VOCABULARIO_WINTHOR } from "../adapters/winthor/vocabulario";
import type { Dependencias } from "../application/dependencias";

// Raiz de composição: o ÚNICO lugar que sabe qual adaptador atende cada tipo
// de conexão. Um ERP ou motor novo entra como um `case` aqui — domínio, casos
// de uso, procedures e tela continuam iguais.

export class SemBancoExterno extends Error {
  constructor() {
    super(
      "Esta organização não tem um banco de ERP conectado. Configure a conexão em Integrações.",
    );
    this.name = "SemBancoExterno";
  }
}

export async function dependenciasDaOrg(
  organizationId: string,
): Promise<Dependencias> {
  const conexao = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { kind: true, configCiphertext: true },
  });
  if (!conexao?.configCiphertext) throw new SemBancoExterno();

  const repositorio = criarRepositorioNaConexao(organizationId);
  const nerp = criarConferenciaNoNerp(organizationId);
  const destino = criarDestinoNoNerp(organizationId);

  switch (conexao.kind) {
    case "WINTHOR_ORACLE":
      return {
        banco: criarBancoOracle(
          organizationId,
          parseOracleConfig(conexao.configCiphertext),
        ),
        vocabulario: VOCABULARIO_WINTHOR,
        repositorio,
        nerp,
        destino,
      };
    case "NATIVE":
      throw new SemBancoExterno();
  }
}
