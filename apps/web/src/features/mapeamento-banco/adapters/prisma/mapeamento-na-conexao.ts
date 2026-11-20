import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { lerMapeamento, mapeamentoSchema } from "../../domain/mapeamento";
import type { ConferenciaNoNerpPort } from "../../ports/nerp";
import type { MapeamentoRepositorio } from "../../ports/repositorio";

// Adaptadores do lado do NERP: onde o mapeamento fica guardado e a conferência
// dos códigos lidos contra o cadastro. Sempre escopados pela organização.

export function criarRepositorioNaConexao(
  organizationId: string,
): MapeamentoRepositorio {
  return {
    async carregar() {
      const conexao = await prisma.erpConnection.findUnique({
        where: { organizationId },
        select: { dataMapping: true },
      });
      return lerMapeamento(conexao?.dataMapping);
    },
    async salvar(mapeamento) {
      // Valida de novo na gravação: o JSON não pode sair daqui fora do formato
      // que o `lerMapeamento` aceita, senão o próximo carregamento o descartaria.
      const valido = mapeamentoSchema.parse(mapeamento);
      await prisma.erpConnection.update({
        where: { organizationId },
        data: { dataMapping: valido as Prisma.InputJsonValue },
      });
    },
  };
}

export function criarConferenciaNoNerp(
  organizationId: string,
): ConferenciaNoNerpPort {
  return {
    async codigosExistentes(tipo, codigos) {
      // Categoria ainda não guarda o código do ERP — o vínculo chega com o
      // sync de categorias.
      if (tipo === "categoria") return null;
      if (codigos.length === 0) return new Set();
      const produtos = await prisma.product.findMany({
        where: { organizationId, erpCode: { in: [...new Set(codigos)] } },
        select: { erpCode: true },
      });
      return new Set(
        produtos.flatMap((produto) =>
          produto.erpCode ? [produto.erpCode] : [],
        ),
      );
    },
  };
}
