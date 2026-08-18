"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  ArrowLeft,
  DownloadIcon,
  SparklesIcon,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useGenerateTradeCatalogPdf, useTradeCatalog } from "../hooks/use-trade-catalog-doc";
import { CatalogCoverEditor } from "./cover-editor/catalog-cover-editor";
import { CatalogPagesList } from "./catalog-pages/catalog-pages-list";
import { CatalogStatusBadge } from "./catalog-status-badge";
import { ShareLinkButton } from "./share-link-button";

interface CatalogEditorProps {
  catalogId: string;
}

export function CatalogEditor({ catalogId }: CatalogEditorProps) {
  const { catalog, isLoading } = useTradeCatalog(catalogId);
  const generatePdf = useGenerateTradeCatalogPdf();
  const [pendingMode, setPendingMode] = useState<"queue" | "sync" | null>(null);

  if (isLoading || !catalog) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const isGenerating = catalog.status === "GENERATING";
  const isFailed = catalog.status === "FAILED";
  const hasPages = catalog.pages.length > 0;

  const runGenerate = (sync: boolean) => {
    setPendingMode(sync ? "sync" : "queue");
    generatePdf.mutate(
      { id: catalogId, sync: sync || undefined },
      { onSettled: () => setPendingMode(null) },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/trade/catalogo-pdv" aria-label="Voltar para catálogos">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{catalog.name}</h1>
              <CatalogStatusBadge status={catalog.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {catalog.pages.length} página(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {catalog.status === "READY" && catalog.pdfKey && (
            <Button asChild variant="outline">
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
          {(isGenerating || isFailed) && (
            <Button
              variant="outline"
              onClick={() => runGenerate(true)}
              disabled={generatePdf.isPending || !hasPages}
              title="Renderiza o PDF na hora, sem passar pela fila"
            >
              {pendingMode === "sync" ? <Spinner /> : <Zap className="size-4" />}
              Gerar agora
            </Button>
          )}
          <Button
            onClick={() => runGenerate(false)}
            disabled={isGenerating || generatePdf.isPending || !hasPages}
          >
            {pendingMode === "queue" ? <Spinner /> : <SparklesIcon className="size-4" />}
            {isGenerating ? "Gerando…" : isFailed ? "Tentar novamente" : "Gerar PDF"}
          </Button>
        </div>
      </div>

      {isFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            A geração do PDF falhou. Clique em <strong>Tentar novamente</strong>{" "}
            ou em <strong>Gerar agora</strong> para renderizar sem a fila.
          </p>
        </div>
      )}

      {isGenerating && (
        <p className="text-sm text-muted-foreground">
          Gerando o PDF… Se estiver demorando, use <strong>Gerar agora</strong>{" "}
          para renderizar imediatamente.
        </p>
      )}

      <ShareLinkButton
        catalogId={catalogId}
        shareToken={catalog.shareToken}
        isPublic={catalog.isPublic}
      />

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
          <TabsTrigger value="cover">Capa e Contracapa</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <CatalogPagesList catalogId={catalogId} pages={catalog.pages} />
        </TabsContent>

        <TabsContent value="cover" className="mt-4">
          <CatalogCoverEditor
            catalogId={catalogId}
            coverLayout={catalog.coverLayout}
            closingLayout={catalog.closingLayout}
            coverBackground={catalog.coverBackground}
            closingBackground={catalog.closingBackground}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
