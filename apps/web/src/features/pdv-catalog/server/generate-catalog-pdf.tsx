import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { v4 as uuidv4 } from "uuid";
import type {
  CoverBackground,
  CoverElement,
} from "@/features/books/lib/cover-layout";
import { catalogRowsSchema } from "@/features/pdv-catalog/lib/catalog-types";
import { constructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";
import { uploadBufferToR2 } from "@/lib/upload-buffer-to-r2";
import { formatBRL } from "@/utils/currency-formatter";
import {
  CatalogDocument,
  type CatalogDocumentData,
} from "../pdf/catalog-document";

// `imageKey` de cada elemento tipo "image" vira URL completa — catalog-document.tsx
// só sabe renderizar, não resolve keys do R2. Duplica o helper equivalente do
// Book de propósito (sem depender de features/books/server).
function resolveLayoutImages(layout: unknown): CoverElement[] | null {
  if (!Array.isArray(layout)) return null;
  return (layout as CoverElement[]).map((element) =>
    element.type === "image" && element.imageKey
      ? { ...element, imageKey: constructUrl(element.imageKey) }
      : element,
  );
}

function readBackground(value: unknown): CoverBackground | null {
  if (!value || typeof value !== "object") return null;
  const background = value as CoverBackground;
  return {
    ...background,
    imageKey: background.imageKey ? constructUrl(background.imageKey) : null,
  };
}

export async function generateTradeCatalogPdf(
  catalogId: string,
): Promise<string> {
  const catalog = await prisma.tradeCatalog.findUnique({
    where: { id: catalogId },
    include: { pages: { orderBy: { order: "asc" } } },
  });

  if (!catalog) throw new Error("Catálogo não encontrado");

  const data: CatalogDocumentData = {
    catalogName: catalog.name,
    showIndex: catalog.showIndex,
    coverLayout: resolveLayoutImages(catalog.coverLayout),
    closingLayout: resolveLayoutImages(catalog.closingLayout),
    coverBackground: readBackground(catalog.coverBackground),
    closingBackground: readBackground(catalog.closingBackground),
    pages: catalog.pages.map((page) => {
      const parsedRows = catalogRowsSchema.safeParse(page.rows);
      const rows = parsedRows.success ? parsedRows.data : [];
      return {
        title: page.title,
        photoUrls: page.photoKeys.map(constructUrl),
        rows: rows.map((row) => ({
          storeName: row.storeName,
          quantity: row.quantity,
          priceLabel: row.price != null ? formatBRL(row.price) : null,
          status: row.status,
        })),
      };
    }),
  };

  const buffer = await renderToBuffer(<CatalogDocument data={data} />);
  const key = `trade-catalogs/${catalogId}-${uuidv4()}.pdf`;
  await uploadBufferToR2(key, Buffer.from(buffer), "application/pdf");

  await prisma.tradeCatalog.update({
    where: { id: catalogId },
    data: { pdfKey: key, status: "READY", generatedAt: new Date() },
  });

  return key;
}
