import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  ProductCreationError,
  createProductForOrg,
} from "@/features/products/server/create-product";
import prisma from "@/lib/db";
import type { AcaoDeCliente, AcaoDeProduto } from "../../domain/importacao";
import type {
  DestinoNoNerpPort,
  ResultadoDaGravacao,
} from "../../ports/destino";

// Adaptador do NERP para a importação. Sempre escopado pela organização; só
// executa o que as regras decidiram (`domain/importacao.ts`).

/** Atualizações por transação: pequenas, para não segurar o banco. */
const LOTE_DE_ATUALIZACAO = 200;
/** 6 colunas × 5 mil linhas cabe no teto de parâmetros do Postgres. */
const LOTE_DE_INSERCAO = 5000;

function motivoDoErro(erro: unknown): string {
  if (erro instanceof ProductCreationError) return erro.message;
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return "Valor único já usado por outro cadastro (código de barras ou e-mail).";
  }
  return erro instanceof Error ? erro.message.slice(0, 160) : String(erro);
}

/**
 * Roda as atualizações em transações pequenas; se uma falhar (ex.: código de
 * barras que alguém cadastrou entre a leitura e a gravação), refaz aquele
 * lote uma a uma para isolar a linha e seguir com as outras.
 */
async function atualizarEmLotes<T extends { codigo: string }>(
  itens: T[],
  gravar: (item: T) => Prisma.PrismaPromise<unknown>,
  resultado: ResultadoDaGravacao,
) {
  for (let inicio = 0; inicio < itens.length; inicio += LOTE_DE_ATUALIZACAO) {
    const lote = itens.slice(inicio, inicio + LOTE_DE_ATUALIZACAO);
    try {
      await prisma.$transaction(lote.map(gravar));
      resultado.gravados += lote.length;
    } catch {
      for (const item of lote) {
        try {
          await gravar(item);
          resultado.gravados += 1;
        } catch (erro) {
          resultado.falhas.push({
            codigo: item.codigo,
            motivo: motivoDoErro(erro),
          });
        }
      }
    }
  }
}

export function criarDestinoNoNerp(organizationId: string): DestinoNoNerpPort {
  /**
   * `Product.createdById` é obrigatório e aponta para um usuário de verdade;
   * a importação registra o DONO da organização, como o sync do ERP já faz.
   */
  const dono = async () => {
    const membro = await prisma.member.findFirst({
      where: { organizationId, role: "owner" },
      select: { userId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membro) {
      throw new Error(
        "Organização sem dono definido para registrar como criador.",
      );
    }
    return membro.userId;
  };

  const filialDoEstoque = async () => {
    const conexao = await prisma.erpConnection.findUnique({
      where: { organizationId },
      select: { stockBranchCode: true },
    });
    return conexao?.stockBranchCode ?? null;
  };

  return {
    async produtosLocais() {
      return prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          erpCode: true,
          barcode: true,
          packQty: true,
          erpActive: true,
        },
      });
    },

    async aplicarProdutos(acoes) {
      const resultado: ResultadoDaGravacao = { gravados: 0, falhas: [] };
      const agora = new Date();
      const atualizacoes = acoes.filter(
        (acao): acao is Extract<AcaoDeProduto, { acao: "atualizar" }> =>
          acao.acao === "atualizar",
      );
      await atualizarEmLotes(
        atualizacoes,
        (acao) =>
          prisma.product.update({
            where: { id: acao.id },
            data: { ...acao.dados, erpSyncedAt: agora },
          }),
        resultado,
      );

      const criacoes = acoes.filter(
        (acao): acao is Extract<AcaoDeProduto, { acao: "criar" }> =>
          acao.acao === "criar",
      );
      if (criacoes.length === 0) return resultado;
      const criadoPor = await dono();
      // Uma a uma: `createProductForOrg` cuida de slug, categoria e do limite
      // do plano — e uma linha com problema não pode derrubar o lote.
      for (const { codigo, dados } of criacoes) {
        try {
          const criado = await createProductForOrg(
            {
              name: dados.nome,
              barcode: dados.ean ?? undefined,
              costPrice: 0,
              salePrice: 0,
              // Nasce disponível para venda; quem decide o contrário é o usuário.
              isActive: true,
            },
            { orgId: organizationId, userId: criadoPor },
          );
          await prisma.product.update({
            where: { id: criado.id },
            data: {
              erpCode: codigo,
              erpActive: dados.ativoNoErp,
              erpSyncedAt: agora,
              ...(dados.unidadesPorCaixa
                ? { packQty: dados.unidadesPorCaixa }
                : {}),
            },
          });
          resultado.gravados += 1;
        } catch (erro) {
          resultado.falhas.push({ codigo, motivo: motivoDoErro(erro) });
        }
      }
      return resultado;
    },

    async clientesLocais() {
      return prisma.customer.findMany({
        where: { organizationId },
        select: {
          id: true,
          erpCode: true,
          document: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          erpBlocked: true,
        },
      });
    },

    async aplicarClientes(acoes) {
      const resultado: ResultadoDaGravacao = { gravados: 0, falhas: [] };
      const atualizacoes = acoes.filter(
        (acao): acao is Extract<AcaoDeCliente, { acao: "atualizar" }> =>
          acao.acao === "atualizar",
      );
      await atualizarEmLotes(
        atualizacoes,
        (acao) =>
          prisma.customer.update({
            where: { id: acao.id },
            data: acao.dados,
          }),
        resultado,
      );

      const criacoes = acoes.filter(
        (acao): acao is Extract<AcaoDeCliente, { acao: "criar" }> =>
          acao.acao === "criar",
      );
      // createMany: cliente não tem slug nem limite por item, e os e-mails já
      // vêm conferidos contra o que existe na organização.
      for (
        let inicio = 0;
        inicio < criacoes.length;
        inicio += LOTE_DE_INSERCAO
      ) {
        const lote = criacoes.slice(inicio, inicio + LOTE_DE_INSERCAO);
        const dados = lote.map(({ dados: cliente }) => ({
          organizationId,
          name: cliente.nome,
          personType: cliente.pessoa,
          document: cliente.documento,
          email: cliente.email,
          phone: cliente.telefone,
          city: cliente.cidade,
          state: cliente.uf,
          erpCode: cliente.codigo,
          erpBlocked: cliente.bloqueado,
        }));
        try {
          const { count } = await prisma.customer.createMany({ data: dados });
          resultado.gravados += count;
        } catch {
          for (const [indice, linha] of dados.entries()) {
            try {
              await prisma.customer.create({ data: linha });
              resultado.gravados += 1;
            } catch (erro) {
              resultado.falhas.push({
                codigo: lote[indice].codigo,
                motivo: motivoDoErro(erro),
              });
            }
          }
        }
      }
      return resultado;
    },

    async produtosVinculados() {
      const produtos = await prisma.product.findMany({
        where: { organizationId, erpCode: { not: null } },
        select: { id: true, erpCode: true },
      });
      return new Map(
        produtos.flatMap((produto) =>
          produto.erpCode ? [[produto.erpCode, produto.id] as const] : [],
        ),
      );
    },

    filialDoEstoque,

    async substituirEstoque(registros) {
      const agora = new Date();
      const filial = await filialDoEstoque();
      const insercoes = [];
      for (
        let inicio = 0;
        inicio < registros.length;
        inicio += LOTE_DE_INSERCAO
      ) {
        insercoes.push(
          prisma.productBranchStock.createMany({
            data: registros
              .slice(inicio, inicio + LOTE_DE_INSERCAO)
              .map((registro) => ({
                organizationId,
                productId: registro.productId,
                branchCode: registro.filial,
                branchName: registro.nomeFilial,
                stock: registro.disponivel,
                syncedAt: agora,
              })),
          }),
        );
      }
      // Mesmo desenho do sync do ERP (`sync-product-stock.ts`): o espelho é um
      // retrato, então troca inteiro numa transação — produto que zerou não
      // vem na leitura e, sem o delete, ficaria "com estoque" para sempre. O
      // estoque do produto vinculado passa a ser o DISPONÍVEL da filial.
      const atualizarProduto = filial
        ? [
            prisma.$executeRaw(Prisma.sql`
              UPDATE products AS p
                 SET "currentStock" = COALESCE(s.stock, 0)
                FROM products AS linked
                LEFT JOIN product_branch_stocks AS s
                  ON s."productId" = linked.id AND s."branchCode" = ${filial}
               WHERE p.id = linked.id
                 AND linked."organizationId" = ${organizationId}
                 AND linked."erpCode" IS NOT NULL
                 AND p."currentStock" IS DISTINCT FROM COALESCE(s.stock, 0)`),
          ]
        : [];
      const resultados = await prisma.$transaction([
        prisma.productBranchStock.deleteMany({ where: { organizationId } }),
        ...insercoes,
        ...atualizarProduto,
      ]);
      return {
        produtosAtualizados: filial
          ? Number(resultados[resultados.length - 1])
          : 0,
      };
    },
  };
}
