import "server-only";

import prisma from "@/lib/db";
import { createProductForOrg } from "@/features/products/server/create-product";
import { loadOracleConfig } from "./connectors";
import { fetchWinthorProducts } from "./connectors/winthor-products";
import { normalizeBarcode, reconcileProducts } from "./reconcile-products";

// Sync do cadastro de produtos do ERP → banco da organização.
//
// Roda na passada DIÁRIA e no botão "Sincronizar agora"; nunca no cron de 15
// minutos. Cadastro de produto muda pouco e são milhares de linhas — ler isso a
// cada quarto de hora seria desperdício e custo de Inngest, que os crons desta
// base controlam de propósito.

export interface ProductSyncReport {
  /** Linhas lidas do ERP. */
  read: number;
  updated: number;
  created: number;
  /** Sem código de barras: não dá para casar nem criar com segurança. */
  skippedNoBarcode: number;
  /** Código interno no lugar do EAN — casa se já existir, mas não vira produto. */
  skippedInvalidBarcode: number;
  /** Faltam no cadastro, mas `createMissing` estava desligado. */
  createSkipped: number;
  /** EAN repetido dentro do próprio retorno do ERP. */
  duplicatesInSource: number;
  /** Falhas por linha ao criar — não abortam o lote. */
  failed: number;
  /** `true` = nada foi gravado, só contado. */
  dryRun: boolean;
}

/**
 * @param dryRun conta o que faria SEM gravar. Criar produto é a parte
 * irreversível deste sync: num cadastro de milhares, um casamento errado enche
 * a base de linhas para limpar à mão. Rode em relatório primeiro.
 *
 * @param createMissing cria o que não existe no cadastro local. **Desligado por
 * default, de propósito.** O cadastro do ERP é bem maior que o cadastro de
 * venda — no Armazém Carvalho são ~24 mil linhas no Oracle contra ~5,7 mil
 * produtos —, então ligar isso numa passada automática despejaria milhares de
 * produtos que ninguém pediu. Atualizar o status é idempotente e roda sempre;
 * criar é uma decisão de quem administra, tomada uma vez.
 */
export async function syncErpProducts(
  organizationId: string,
  {
    dryRun = false,
    createMissing = false,
  }: { dryRun?: boolean; createMissing?: boolean } = {},
): Promise<ProductSyncReport> {
  const config = await loadOracleConfig(organizationId);
  const external = await fetchWinthorProducts(config);

  // Só id e barcode: o cadastro pode ter milhares de linhas e nada mais é
  // preciso para reconciliar.
  const local = await prisma.product.findMany({
    where: { organizationId },
    select: { id: true, barcode: true },
  });

  const plan = reconcileProducts(external, local);
  const report: ProductSyncReport = {
    read: external.length,
    updated: 0,
    created: 0,
    skippedNoBarcode: plan.skippedNoBarcode.length,
    skippedInvalidBarcode: plan.skippedInvalidBarcode.length,
    createSkipped: createMissing ? 0 : plan.toCreate.length,
    duplicatesInSource: plan.duplicatesInSource.length,
    failed: 0,
    dryRun,
  };

  if (dryRun) {
    report.updated = plan.toUpdate.length;
    report.created = createMissing ? plan.toCreate.length : 0;
    return saveReport(organizationId, report);
  }

  // `Product.createdById` é obrigatório e aponta para um User de verdade, mas o
  // sync roda em cron, sem sessão. Atribui ao DONO da organização: é quem
  // responde pelo cadastro, e deixa rastro de que veio do sync (`erpCode`).
  const owner = createMissing
    ? await prisma.member.findFirst({
        where: { organizationId, role: "owner" },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
      })
    : null;
  if (createMissing && !owner) {
    throw new Error(
      "Organização sem dono definido — o sync de produtos precisa de um usuário para registrar como criador.",
    );
  }

  const syncedAt = new Date();

  // Atualização em lotes por STATUS: agrupar em dois `updateMany` seria mais
  // rápido, mas cada produto tem `erpCode` próprio, então vai em transações
  // fatiadas — o que também evita uma transação gigante segurando o banco.
  const CHUNK = 200;
  for (let i = 0; i < plan.toUpdate.length; i += CHUNK) {
    const chunk = plan.toUpdate.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.product.update({
          where: { id: u.id },
          // Só o espelho do ERP. Nome, preço e `isActive` são do usuário — o
          // sync sobrescrevê-los desfaria edição manual a cada passada.
          data: {
            erpActive: u.erpActive,
            erpCode: u.erpCode,
            erpSyncedAt: syncedAt,
          },
        }),
      ),
    );
    report.updated += chunk.length;
  }

  // Criação uma a uma: `createProductForOrg` cuida de slug e categoria, e um
  // erro numa linha não pode derrubar o lote inteiro.
  if (createMissing && owner) {
    for (const item of plan.toCreate) {
      try {
        const created = await createProductForOrg(
          {
            name: item.name || `Produto ${item.externalCode}`,
            barcode: normalizeBarcode(item.barcode) || undefined,
            costPrice: 0,
            salePrice: item.salePrice ?? 0,
            // Nasce disponível para venda; quem decide o contrário é o usuário.
            isActive: true,
          },
          { orgId: organizationId, userId: owner.userId },
        );
        await prisma.product.update({
          where: { id: created.id },
          data: {
            erpActive: item.isActive,
            erpCode: item.externalCode,
            erpSyncedAt: syncedAt,
          },
        });
        report.created += 1;
      } catch (error) {
        report.failed += 1;
        console.error(
          `[erp-sync/produtos] falha ao criar ${item.externalCode}:`,
          error,
        );
      }
    }
  }

  return saveReport(organizationId, report);
}

/**
 * Guarda o resultado na conexão para a tela de Integrações.
 *
 * Falha aqui não derruba o sync: o trabalho já foi feito e perder o relatório é
 * bem menos grave do que marcar como falha uma passada que deu certo.
 */
async function saveReport(
  organizationId: string,
  report: ProductSyncReport,
): Promise<ProductSyncReport> {
  await prisma.erpConnection
    .update({
      where: { organizationId },
      data: {
        productSyncAt: new Date(),
        productSyncDryRun: report.dryRun,
        // `ProductSyncReport` é só números e um booleano; o cast é para a
        // tipagem de Json do Prisma, que exige índice de string.
        productSyncReport: { ...report },
      },
    })
    .catch((error) => {
      console.error("[erp-sync/produtos] falha ao gravar o relatório:", error);
    });
  return report;
}
