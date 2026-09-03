import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Diagnóstico SOMENTE LEITURA do preço que o PDV resolve para um conjunto de
 * produtos. Existe porque "a soma do PDV não bate" tem cinco causas possíveis e
 * elas são indistinguíveis pela tela: o preço que a grade mostra é o
 * `salePrice` do cadastro, mas o que entra no carrinho (e no cupom) é o que o
 * `resolveManyPrices` devolve — faixa da tabela, promoção do produto ou
 * desconto de categoria, nessa ordem.
 *
 * Uso:
 *   DATABASE_URL="<banco>" pnpm --filter @nerp/web exec tsx scripts/diagnose-pdv-preco.ts "mercadinho sousa" 000043 003754 002203 003312
 *
 * Não escreve nada. Pode rodar contra produção.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const [orgTerm, ...codes] = process.argv.slice(2);

const brl = (v: unknown) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// O código chega zero-padded ("000043") mas o cadastro pode ter gravado "43".
// Ambas as formas entram na busca — se casar por mais de uma, isso já é achado.
const variants = (code: string) => {
  const stripped = code.replace(/^0+/, "");
  return Array.from(new Set([code, stripped].filter(Boolean)));
};

async function main() {
  if (!orgTerm || codes.length === 0) {
    console.error(
      'uso: tsx scripts/diagnose-pdv-preco.ts "<nome da org>" <codigo> [codigo...]',
    );
    process.exit(1);
  }

  const org = await prisma.organization.findFirst({
    where: { name: { contains: orgTerm, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    const todas = await prisma.organization.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });
    console.error(`Org não encontrada para "${orgTerm}".`);
    console.error(`Orgs neste banco: ${todas.map((o) => o.name).join(", ")}`);
    process.exit(1);
  }
  console.log(`\nORG  ${org.name} (${org.slug}) ${org.id}`);

  const listaPadrao = await prisma.priceList.findFirst({
    where: { organizationId: org.id, isDefault: true, isActive: true },
    select: { id: true, name: true },
  });
  console.log(
    `TABELA PADRÃO  ${listaPadrao ? `${listaPadrao.name} (${listaPadrao.id})` : "— nenhuma (só promoção do produto se aplica)"}`,
  );

  const now = new Date();
  const descontosCategoria = listaPadrao
    ? await prisma.priceListCategoryDiscount.findMany({
        where: {
          organizationId: org.id,
          priceListId: listaPadrao.id,
          endsAt: { gte: now },
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        select: {
          categoryId: true,
          percentDiscount: true,
          startsAt: true,
          endsAt: true,
          category: { select: { name: true, path: true } },
        },
      })
    : [];
  console.log(
    `DESCONTOS DE CATEGORIA VIGENTES  ${
      descontosCategoria.length === 0
        ? "nenhum"
        : descontosCategoria
            .map(
              (d) =>
                `${d.category?.name ?? d.categoryId} −${Number(d.percentDiscount)}%`,
            )
            .join(" · ")
    }`,
  );

  let somaCadastro = 0;
  let somaResolvida = 0;

  for (const code of codes) {
    const formas = variants(code);
    const produtos = await prisma.product.findMany({
      where: {
        organizationId: org.id,
        OR: [{ sku: { in: formas } }, { barcode: { in: formas } }],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        salePrice: true,
        promotionalPrice: true,
        costPrice: true,
        discountPercent: true,
        discountStartsAt: true,
        discountEndsAt: true,
        categoryId: true,
        category: { select: { name: true, path: true } },
      },
    });

    console.log(`\n─── código ${code} ${"─".repeat(46)}`);
    if (produtos.length === 0) {
      console.log("  NÃO ENCONTRADO por sku nem barcode nesta org.");
      continue;
    }
    if (produtos.length > 1) {
      console.log(
        `  ⚠ ${produtos.length} produtos casam com este código — o PDV pega um deles de forma não determinística.`,
      );
    }

    for (const p of produtos) {
      const sale = Number(p.salePrice);
      console.log(`  ${p.name}`);
      console.log(
        `    sku=${p.sku ?? "—"}  barcode=${p.barcode ?? "—"}  un=${p.unit}  id=${p.id}`,
      );
      console.log(
        `    salePrice=${brl(sale)}  promotionalPrice=${p.promotionalPrice === null ? "—" : brl(p.promotionalPrice)}  costPrice=${brl(p.costPrice)}`,
      );
      console.log(
        `    categoria=${p.category?.name ?? "—"}  path=${p.category?.path ?? "—"}`,
      );

      // 1) faixa da tabela padrão (vence tudo)
      const faixas = listaPadrao
        ? await prisma.productPrice.findMany({
            where: {
              organizationId: org.id,
              productId: p.id,
              priceListId: listaPadrao.id,
            },
            orderBy: { minQuantity: "asc" },
            select: {
              minQuantity: true,
              pricingMode: true,
              unitPrice: true,
              percentDiscount: true,
            },
          })
        : [];
      console.log(
        `    faixas na tabela padrão: ${
          faixas.length === 0
            ? "nenhuma"
            : faixas
                .map(
                  (f) =>
                    `[min ${f.minQuantity} · ${f.pricingMode} · unitPrice=${f.unitPrice === null ? "null" : brl(f.unitPrice)} · %=${f.percentDiscount === null ? "null" : Number(f.percentDiscount)}]`,
                )
                .join(" ")
        }`,
      );

      // Réplica da decisão do resolver para quantidade 1.
      const faixa = faixas
        .filter((f) => f.minQuantity <= 1)
        .sort((a, b) => b.minQuantity - a.minQuantity)[0];

      let resolvido = sale;
      let origem = "product (salePrice)";
      if (faixa) {
        if (faixa.pricingMode === "PERCENT_DISCOUNT") {
          const pct = Number(faixa.percentDiscount ?? 0);
          resolvido = Math.round(sale * (1 - pct / 100) * 100) / 100;
          origem = `tier-percent (−${pct}%)`;
        } else {
          resolvido = Number(faixa.unitPrice ?? sale);
          origem = "tier-fixed";
        }
      } else {
        const pct =
          p.discountPercent === null ? null : Number(p.discountPercent);
        const dentro =
          pct !== null &&
          pct > 0 &&
          (!p.discountStartsAt || p.discountStartsAt <= now) &&
          (!p.discountEndsAt || p.discountEndsAt >= now);
        if (dentro) {
          resolvido =
            Math.round(sale * (1 - (pct as number) / 100) * 100) / 100;
          origem = `product-discount (−${pct}% · ${p.discountStartsAt?.toISOString() ?? "sem início"} → ${p.discountEndsAt?.toISOString() ?? "sem fim"})`;
        } else {
          const ancestry = p.category?.path
            ? p.category.path.split("/")
            : p.categoryId
              ? [p.categoryId]
              : [];
          let melhor: number | null = null;
          let prof = -1;
          for (const d of descontosCategoria) {
            const i = ancestry.indexOf(d.categoryId);
            if (i > prof) {
              prof = i;
              melhor = Number(d.percentDiscount);
            }
          }
          if (melhor !== null && melhor > 0) {
            resolvido = Math.round(sale * (1 - melhor / 100) * 100) / 100;
            origem = `category-discount (−${melhor}%)`;
          }
        }
      }

      if (p.discountPercent !== null) {
        console.log(
          `    promoção do produto: −${Number(p.discountPercent)}%  janela ${p.discountStartsAt?.toISOString() ?? "—"} → ${p.discountEndsAt?.toISOString() ?? "—"}`,
        );
      }
      const marca =
        Math.abs(resolvido - sale) > 0.001 ? "  ⚠ DIVERGE DA GRADE" : "";
      console.log(
        `    >>> PDV cobra ${brl(resolvido)} (grade mostra ${brl(sale)}) · origem: ${origem}${marca}`,
      );

      if (produtos.length === 1) {
        somaCadastro += sale;
        somaResolvida += resolvido;
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(
    `SOMA pelo salePrice (o que a grade/etiqueta mostra): ${brl(somaCadastro)}`,
  );
  console.log(
    `SOMA pelo preço resolvido (o que o PDV cobra):       ${brl(somaResolvida)}`,
  );
  console.log(`${"═".repeat(60)}\n`);

  // Últimas vendas que contenham qualquer um desses produtos: o SaleItem é o
  // snapshot do que foi realmente cobrado, e é ele que fecha o diagnóstico.
  const nomes = codes.flatMap(variants);
  const ids = (
    await prisma.product.findMany({
      where: {
        organizationId: org.id,
        OR: [{ sku: { in: nomes } }, { barcode: { in: nomes } }],
      },
      select: { id: true },
    })
  ).map((p) => p.id);

  const vendas = await prisma.sale.findMany({
    where: {
      organizationId: org.id,
      items: { some: { productId: { in: ids } } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      saleNumber: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      total: true,
      priceListId: true,
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
    },
  });

  console.log("ÚLTIMAS VENDAS COM ESSES PRODUTOS");
  for (const v of vendas) {
    console.log(
      `\n  #${v.saleNumber} ${v.createdAt.toISOString()} · subtotal ${brl(v.subtotal)} · desconto ${brl(v.discount)} · total ${brl(v.total)} · priceListId=${v.priceListId ?? "—"}`,
    );
    for (const i of v.items) {
      console.log(
        `      ${Number(i.quantity)} × ${brl(i.unitPrice)} = ${brl(i.total)}  ${i.productName}`,
      );
    }
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
