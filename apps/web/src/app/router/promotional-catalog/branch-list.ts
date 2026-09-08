import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Filiais do ERP que TÊM estoque espelhado, para o seletor de filial do
// diálogo "Adicionar produto ao catálogo".
//
// Sai do espelho (`ProductBranchStock`), não do Oracle: a lista precisa casar
// exatamente com o que o filtro consegue filtrar. Filial sem nenhum produto em
// estoque não aparece — escolhê-la só devolveria lista vazia.
export const catalogBranchList = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Filiais do ERP com estoque espelhado",
    tags: ["promotional-catalog"],
  })
  .output(
    z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        products: z.number(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await prisma.productBranchStock.groupBy({
      by: ["branchCode", "branchName"],
      where: { organizationId: context.org.id },
      _count: { _all: true },
    });

    // Uma filial renomeada no ERP pode aparecer em duas linhas até a próxima
    // passada do sync; agrupa por código e fica com o primeiro nome não vazio.
    const byCode = new Map<string, { name: string; products: number }>();
    for (const row of rows) {
      const current = byCode.get(row.branchCode);
      const products = (current?.products ?? 0) + row._count._all;
      byCode.set(row.branchCode, {
        name: current?.name || row.branchName || row.branchCode,
        products,
      });
    }

    return [...byCode.entries()]
      .map(([code, v]) => ({ code, name: v.name, products: v.products }))
      .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  });
