"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { formatBRL } from "@/utils/currency-formatter";

interface PublicCatalogViewProps {
  shareToken: string;
}

export function PublicCatalogView({ shareToken }: PublicCatalogViewProps) {
  const { data: catalog, isPending } = useQuery(
    orpc.tradeCatalogDoc.publicGet.queryOptions({ input: { shareToken } }),
  );

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Catálogo não encontrado ou o link não está mais ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{catalog.name}</h1>
        {catalog.status === "READY" && catalog.pdfKey && (
          <Button asChild className="gap-2">
            <a
              href={constructUrl(catalog.pdfKey)}
              target="_blank"
              rel="noreferrer"
            >
              <DownloadIcon className="size-4" />
              Baixar PDF
            </a>
          </Button>
        )}
      </div>

      {catalog.status !== "READY" && (
        <p className="text-sm text-muted-foreground">
          Este catálogo ainda está sendo preparado. Volte em instantes.
        </p>
      )}

      {catalog.showIndex && catalog.pages.length > 0 && (
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Índice
            </p>
            {catalog.pages.map((page, index) => (
              <div key={page.id} className="flex justify-between text-sm">
                <span>{page.title}</span>
                <span className="text-muted-foreground">{index + 1}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {catalog.pages.map((page) => (
          <Card key={page.id}>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-lg font-bold uppercase tracking-tight">
                {page.title}
              </h2>

              {page.photoKeys.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {page.photoKeys.map((key) => (
                    // biome-ignore lint/performance/noImgElement: preview simples de key do R2, sem otimização do next/image
                    <img
                      key={key}
                      src={constructUrl(key)}
                      alt=""
                      className="h-32 w-48 rounded-md border bg-muted object-contain"
                    />
                  ))}
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-center">Qtd.</TableHead>
                      <TableHead>Preço/mês</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.storeName}</TableCell>
                        <TableCell className="text-center">
                          {row.quantity}
                        </TableCell>
                        <TableCell>
                          {row.price != null ? formatBRL(row.price) : "—"}
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
