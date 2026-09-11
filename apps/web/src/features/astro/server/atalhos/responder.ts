import "server-only";

import { limiteDeStars } from "@/features/billing/lib/planos";
import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
import { emEstrelas, formatarEstrelas } from "@/features/stars/lib/decimal";
import { calcularUso } from "@/features/stars/lib/uso";
import prisma from "@/lib/db";
import { intervaloDoPeriodo, ROTULO_DO_PERIODO } from "../periodo";
import { whereVendaValida } from "@/features/sales/lib/venda-valida";
import { contarCadastros } from "../tools/operacao";
import type { PerguntaReconhecida } from "./reconhecer";

/**
 * A resposta pronta, sem passar pelo modelo.
 *
 * Cada atalho usa a MESMA consulta que a ferramenta equivalente usaria — a
 * contagem de cadastros é a função de `tools/operacao.ts`, a venda passa por
 * `whereVendaValida`. Um segundo caminho de consulta aqui seria o começo de
 * dois números para a mesma pergunta, que é o erro que a Fase 2 existiu para
 * desfazer.
 *
 * A frase é escrita em código e diz de onde veio. Ela não tenta imitar o
 * modelo: é curta, tem o número e para.
 */

function dinheiroBr(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function comExemplo(rotulo: string, conta: { reais: number; exemplo: number }) {
  const total = conta.reais + conta.exemplo;
  if (total === 0) return `Você ainda não tem ${rotulo} cadastrados.`;
  const base = `Você tem ${total} ${rotulo}`;
  // Dizer quantos são de exemplo importa: sem isso, a pessoa toma o número
  // do pacote de demonstração como se fosse a operação dela.
  return conta.exemplo > 0
    ? `${base}, sendo ${conta.exemplo} de exemplo.`
    : `${base}.`;
}

export async function responderPorAtalho(
  organizationId: string,
  pergunta: PerguntaReconhecida,
): Promise<string | null> {
  switch (pergunta.atalho) {
    case "contarProdutos":
    case "contarClientes":
    case "contarFornecedores":
    case "contarLojas": {
      const contagem = await contarCadastros(organizationId);
      const mapa = {
        contarProdutos: ["produtos", contagem.produtos],
        contarClientes: ["clientes", contagem.clientes],
        contarFornecedores: ["fornecedores", contagem.fornecedores],
        contarLojas: ["lojas", contagem.lojas],
      } as const;
      const [rotulo, conta] = mapa[pergunta.atalho];
      return comExemplo(rotulo, conta);
    }

    case "saldoDeStars": {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { starsBalance: true, starsUsedInCycle: true },
      });
      if (!org) return null;
      const { plano } = await planoDaOrganizacao(organizationId);
      const uso = calcularUso({
        saldo: emEstrelas(org.starsBalance),
        limite: limiteDeStars(plano),
        consumido: emEstrelas(org.starsUsedInCycle),
      });
      const saldo = formatarEstrelas(uso.saldo);
      if (uso.limite <= 0) return `Você tem ${saldo} ★ de saldo.`;
      return `Você tem ${saldo} ★ de saldo, e já usou ${formatarEstrelas(uso.consumido)} das ${uso.limite} do plano neste ciclo.`;
    }

    case "resumoDeVendas":
    case "ticketMedio": {
      if (!pergunta.periodo) return null;
      const intervalo = intervaloDoPeriodo(pergunta.periodo);
      const resumo = await prisma.sale.aggregate({
        where: whereVendaValida(organizationId, intervalo),
        _sum: { total: true },
        _count: { _all: true },
      });
      const quantidade = resumo._count._all;
      const total = Number(resumo._sum.total ?? 0);
      const quando = ROTULO_DO_PERIODO[pergunta.periodo].toLowerCase();

      if (quantidade === 0) {
        return `Nenhuma venda registrada ${quando}.`;
      }
      if (pergunta.atalho === "ticketMedio") {
        return `O ticket médio ${quando} foi de ${dinheiroBr(total / quantidade)}, em ${quantidade} venda${quantidade === 1 ? "" : "s"}.`;
      }
      return `${quando.charAt(0).toUpperCase()}${quando.slice(1)} você vendeu ${dinheiroBr(total)} em ${quantidade} venda${quantidade === 1 ? "" : "s"} — ticket médio de ${dinheiroBr(total / quantidade)}.`;
    }

    case "produtoMaisVendido": {
      if (!pergunta.periodo) return null;
      const intervalo = intervaloDoPeriodo(pergunta.periodo);
      // `SaleItem` não tem `organizationId`: o filtro passa pela venda.
      const itens = await prisma.saleItem.groupBy({
        by: ["productName"],
        where: { sale: whereVendaValida(organizationId, intervalo) },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1,
      });
      const quando = ROTULO_DO_PERIODO[pergunta.periodo].toLowerCase();
      const primeiro = itens[0];
      if (!primeiro) return `Nenhuma venda registrada ${quando}.`;
      return `O que mais saiu ${quando} foi ${primeiro.productName}: ${Number(primeiro._sum.quantity ?? 0)} unidades, ${dinheiroBr(Number(primeiro._sum.total ?? 0))}.`;
    }

    case "contarCatalogos": {
      const [total, exemplo] = await Promise.all([
        prisma.promotionalCatalog.count({ where: { organizationId } }),
        prisma.promotionalCatalog.count({
          where: { organizationId, isDemo: true },
        }),
      ]);
      return comExemplo("catálogos promocionais", {
        reais: total - exemplo,
        exemplo,
      });
    }

    case "contarEstoqueBaixo": {
      // A MESMA regra da tool `estoqueBaixo` e dos widgets do dashboard.
      const total = await prisma.product.count({
        where: {
          organizationId,
          isActive: true,
          trackStock: true,
          currentStock: { lte: prisma.product.fields.minStock },
        },
      });
      if (total === 0) {
        return "Nenhum produto está abaixo do estoque mínimo agora.";
      }
      return `${total} produto${total === 1 ? " está" : "s estão"} com estoque igual ou abaixo do mínimo.`;
    }

    default:
      return null;
  }
}
