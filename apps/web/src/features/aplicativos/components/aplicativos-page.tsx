"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  Monitor,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useLatestDesktopRelease } from "../hooks/use-aplicativos";

type ReleaseDownload = {
  label: string;
  os: "windows" | "macos" | "linux";
  format: string;
  url: string;
  size: number;
  sha256?: string;
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1).replace(".", ",")} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

// O link estável (`/api/desktop/download`) sempre aponta para o release atual,
// então serve para mandar por WhatsApp/chamado sem ficar desatualizado depois
// da próxima publicação.
function stableDownloadHref(os: string) {
  return `/api/desktop/download?os=${os}`;
}

function CopyableHash({ sha256 }: { sha256: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(sha256);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="size-3 shrink-0" />
      ) : (
        <Copy className="size-3 shrink-0" />
      )}
      <span className="truncate font-mono">SHA-256 {sha256}</span>
    </button>
  );
}

function DownloadRow({ download }: { download: ReleaseDownload }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="font-medium text-sm">{download.label}</p>
        <p className="text-muted-foreground text-xs">
          {download.format.toUpperCase()} · {formatSize(download.size)}
        </p>
        {download.sha256 && <CopyableHash sha256={download.sha256} />}
      </div>
      <Button asChild>
        <a href={stableDownloadHref(download.os)} download>
          <Download className="size-4" />
          Baixar
        </a>
      </Button>
    </div>
  );
}

function ReleaseCard() {
  const { data, isPending, isError, refetch, isRefetching } =
    useLatestDesktopRelease();

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Falha da consulta e manifesto inalcançável levam à mesma saída para quem
  // olha a tela: não dá para baixar agora, e a ação é tentar de novo.
  if (isError || data.status === "unavailable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            Não foi possível consultar a versão mais recente
          </CardTitle>
          <CardDescription>
            {!isError && data.reason
              ? `Detalhe técnico: ${data.reason}.`
              : "O servidor de downloads não respondeu."}{" "}
            Tente de novo em alguns instantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const release = data.release;
  if (!release) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nenhuma versão publicada</CardTitle>
          <CardDescription>
            O NERP Caixa ainda não foi disponibilizado para download neste
            ambiente. Fale com o suporte para receber o instalador.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Monitor className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">NERP Caixa</CardTitle>
          <Badge variant="outline">versão {release.version}</Badge>
        </div>
        <CardDescription>
          Frente de caixa instalada no computador da loja. Registra vendas mesmo
          com a internet fora e sincroniza sozinho quando a conexão volta.
          Publicada em{" "}
          {format(new Date(release.publishedAt), "d 'de' MMMM 'de' yyyy", {
            locale: ptBR,
          })}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {release.downloads.map((download) => (
          <DownloadRow key={download.url} download={download} />
        ))}

        {release.notes && (
          <>
            <Separator />
            <div>
              <h3 className="mb-1 font-medium text-sm">Nesta versão</h3>
              <p className="whitespace-pre-line text-muted-foreground text-sm">
                {release.notes}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AplicativosPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          Aplicativos offline
        </h1>
        <p className="text-muted-foreground text-sm">
          Programas que você instala no computador da loja e continuam
          funcionando sem internet.
        </p>
      </div>

      <ReleaseCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
            O Windows vai avisar &quot;Editor desconhecido&quot;
          </CardTitle>
          <CardDescription>
            O instalador ainda não tem assinatura digital, então o SmartScreen
            mostra um aviso azul. O arquivo é o nosso — para continuar, clique
            em <strong>Mais informações</strong> e depois em{" "}
            <strong>Executar assim mesmo</strong>. Para conferir que o download
            não foi adulterado, compare o SHA-256 acima com o do arquivo baixado
            (no PowerShell:{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              Get-FileHash arquivo.exe
            </code>
            ).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como instalar e parear</CardTitle>
          <CardDescription>
            Leva menos de um minuto e não precisa configurar servidor — o
            aplicativo já vem apontado para a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>Baixe e execute o instalador no computador do caixa.</li>
            <li>
              Abra o <strong>NERP Caixa</strong> pelo atalho criado na área de
              trabalho.
            </li>
            <li>
              Na tela de pareamento, informe o{" "}
              <strong>mesmo e-mail e senha</strong> que você usa aqui no sistema
              e dê um nome ao terminal (ex.: &quot;Caixa 01&quot;).
            </li>
            <li>
              Pronto. O terminal baixa o catálogo de produtos da sua empresa e
              já pode vender. O pareamento fica salvo — não precisa repetir a
              cada dia.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="size-4 text-muted-foreground" />O que funciona
            sem internet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <p className="font-medium">Funciona offline</p>
            <p className="text-muted-foreground">
              Busca de produtos no catálogo já baixado, carrinho, abertura e
              fechamento de caixa, sangria, suprimento e registro de vendas. As
              operações ficam numa fila e sobem em ordem quando a conexão volta.
            </p>
          </div>
          <div>
            <p className="font-medium">Precisa de internet</p>
            <p className="text-muted-foreground">
              O primeiro pareamento do terminal e a atualização do catálogo
              (preços e produtos novos). Uma venda registrada offline só aparece
              nos relatórios do sistema depois de sincronizar.
            </p>
          </div>
          <div>
            <p className="font-medium">Requisitos</p>
            <p className="text-muted-foreground">
              Windows 10 ou 11, 64 bits. Se o Windows pedir o{" "}
              <em>WebView2 Runtime</em>, o próprio instalador o baixa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
