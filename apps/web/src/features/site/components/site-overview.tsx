"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteOverview } from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

export function SiteOverview() {
  const { overview, isLoading } = useSiteOverview();

  const counts = overview?.counts;
  const pending = overview?.pending ?? [];

  return (
    <>
      <SitePageHeader
        title="Painel"
        description="O que está no ar agora e o que ainda está em rascunho."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                Ver o site
              </a>
            </Button>
            <Button asChild>
              <Link href="/site/paginas">Páginas</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="soluções no menu"
          value={counts?.solucoes}
          loading={isLoading}
        />
        <Stat label="segmentos" value={counts?.segmentos} loading={isLoading} />
        <Stat
          label="páginas publicadas"
          value={counts?.publicadas}
          loading={isLoading}
        />
        <Stat label="rascunhos" value={counts?.rascunhos} loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterações não publicadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ficam só no rascunho até você publicar.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {!isLoading && pending.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tudo publicado. Nada esperando.
            </p>
          )}
          {pending.map((item) => (
            <Link
              key={item.id}
              href={`/site/paginas/${item.id}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex-1">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.detail}
                </span>
              </span>
              <Badge variant="secondary">rascunho</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="text-2xl font-semibold leading-none">{value ?? 0}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
