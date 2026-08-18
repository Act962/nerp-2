import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

const ORACLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_$#]{0,29}$/;

function assertIdentifier(value: string): string {
  if (!ORACLE_IDENTIFIER.test(value)) {
    throw new Error(`Nome de schema Oracle inválido: ${value}`);
  }
  return value;
}

// Timeout curto — é consulta interativa (o usuário está com a tela aberta
// esperando), não o sync noturno. Mesma janela do explorador de Oracle.
const QUERY_TIMEOUT_MS = 20_000;
// Página fixa. `pageSize+1` é o truque pra saber se há próxima sem custar um
// COUNT(*) sobre 20k+ linhas com LIKE (que é lento).
const PAGE_SIZE = 25;
const MAX_PAGE = 400; // teto sanidade: 400 * 25 = 10k resultados navegáveis.

interface ProdutoRow {
  CODPROD: number;
  DESCRICAO: string | null;
  DIRFOTOPROD: string | null;
}

// Busca produtos no Winthor (PCPRODUT) com foto REGISTRADA no cadastro
// (DIRFOTOPROD), cruzando com o catálogo do NERP pelo SKU.
//
// IMPORTANTE — o que isso NÃO faz: DIRFOTOPROD guarda um caminho de rede
// Windows (ex. "P:\img_prod\3133.JPG"), não a imagem. O Oracle nunca teve os
// bytes do arquivo — só o texto do caminho. Este endpoint é um AUDITOR: diz
// quais produtos o Winthor registrou foto, e se essa foto já chegou ou não no
// NERP (comparando pelo SKU = CODPROD). Quem tem acesso à rede/RDP do
// Winthor usa esta lista para saber exatamente quais arquivos buscar; depois
// sobe pelo fluxo normal de "Importar imagens em massa" (pasta local/Drive).
export const searchOracleProductImages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Buscar produtos com foto registrada no Winthor (Oracle)",
    tags: ["products"],
  })
  .input(
    z.object({
      // Código (CODPROD) ou trecho da descrição. Vazio = mais recentes.
      search: z.string().trim().max(120).optional(),
      // 0-indexed. Cliente reseta pra 0 quando o filtro muda.
      page: z.number().int().min(0).max(MAX_PAGE).default(0),
    }),
  )
  .output(
    z.object({
      connected: z.boolean(),
      rows: z.array(
        z.object({
          codprod: z.string(),
          descricao: z.string(),
          caminhoWinthor: z.string(),
          product: z
            .object({
              id: z.string(),
              name: z.string(),
              hasThumbnail: z.boolean(),
            })
            .nullable(),
        }),
      ),
      page: z.number().int(),
      pageSize: z.number().int(),
      hasMore: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    let config: Awaited<ReturnType<typeof loadOracleConfig>>;
    try {
      config = await loadOracleConfig(context.org.id);
    } catch {
      // Sem conexão Oracle configurada — não é erro, é "nada pra mostrar".
      return {
        connected: false as const,
        rows: [],
        page: 0,
        pageSize: PAGE_SIZE,
        hasMore: false,
      };
    }

    const schema = assertIdentifier(config.schema);
    const search = input.search?.trim() || null;
    // Puxa PAGE_SIZE+1: se voltar >PAGE_SIZE, sabemos que existe próxima
    // página sem precisar de um COUNT(*) caro sobre 20k+ linhas com LIKE.
    const offset = input.page * PAGE_SIZE;
    const limit = PAGE_SIZE + 1;

    let raw: ProdutoRow[];
    try {
      raw = await withOracleReadOnly(
        config,
        (query) =>
          query<ProdutoRow>(
            `SELECT CODPROD, DESCRICAO, DIRFOTOPROD
               FROM ${schema}.PCPRODUT
              WHERE DIRFOTOPROD IS NOT NULL
                AND TRIM(DIRFOTOPROD) IS NOT NULL
                AND (:search IS NULL
                     OR UPPER(DESCRICAO) LIKE '%' || UPPER(:search) || '%'
                     OR TO_CHAR(CODPROD) LIKE '%' || :search || '%')
              ORDER BY CODPROD DESC
              OFFSET :offset ROWS
              FETCH NEXT :limit ROWS ONLY`,
            { search, offset, limit },
          ),
        { callTimeoutMs: QUERY_TIMEOUT_MS },
      );
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Falha ao consultar o Winthor: ${(error as Error).message.slice(0, 200)}`,
      });
    }

    const hasMore = raw.length > PAGE_SIZE;
    const rows = hasMore ? raw.slice(0, PAGE_SIZE) : raw;

    // Match por SKU = CODPROD (texto), único vínculo disponível hoje entre
    // o cadastro do NERP e o do Winthor — não existe campo externCode formal.
    const codes = rows.map((row) => String(row.CODPROD));
    const products =
      codes.length > 0
        ? await prisma.product.findMany({
            where: { organizationId: context.org.id, sku: { in: codes } },
            select: { id: true, name: true, sku: true, thumbnail: true },
          })
        : [];
    const bySku = new Map(products.map((product) => [product.sku, product]));

    return {
      connected: true as const,
      rows: rows.map((row) => {
        const codprod = String(row.CODPROD);
        const product = bySku.get(codprod);
        return {
          codprod,
          descricao: row.DESCRICAO?.trim() || `Produto ${codprod}`,
          caminhoWinthor: row.DIRFOTOPROD?.trim() ?? "",
          product: product
            ? {
                id: product.id,
                name: product.name,
                hasThumbnail: !!product.thumbnail,
              }
            : null,
        };
      }),
      page: input.page,
      pageSize: PAGE_SIZE,
      hasMore,
    };
  });
