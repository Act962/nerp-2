"use client";

import {
  ChevronRight,
  Package,
  ScanBarcode,
  Search,
  Tag,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useClienteFv,
  useProdutoFv,
  useProdutosFv,
} from "../hooks/use-forca-vendas";
import { temCubagem } from "../lib/cubagem";
import { formatarData, formatarQuantidade, formatBRL } from "../lib/formatar";
import { FvPagina, Linha, Secao, Vazio } from "./fv-pagina";

// A câmera só existe no navegador: o leitor carrega sem SSR.
const BarcodeScanner = dynamic(
  () =>
    import("@/features/shopper/components/barcode-scanner").then((mod) => ({
      default: mod.BarcodeScanner,
    })),
  { ssr: false, loading: () => <Skeleton className="aspect-square w-full" /> },
);

type ProdutoDaLista = {
  id: string;
  nome: string;
  sku: string | null;
  marca: string | null;
  imagem: string | null;
  preco: number;
  precoBase: number;
  emOferta: boolean;
  unidadesPorCaixa: number | null;
  disponivel: number | null;
};

export function Miniatura({
  chave,
  nome,
}: {
  chave: string | null;
  nome: string;
}) {
  const url = chave ? constructUrl(chave) : "";
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {url ? (
        // biome-ignore lint/performance/noImgElement: imagem do produto no R2
        <img src={url} alt={nome} className="size-full object-contain" />
      ) : (
        <Package className="size-6 text-muted-foreground" />
      )}
    </div>
  );
}

export function CartaoDeProduto({
  produto,
  href,
  acao,
}: {
  produto: ProdutoDaLista;
  href?: string;
  acao?: React.ReactNode;
}) {
  const conteudo = (
    <>
      <Miniatura chave={produto.imagem} nome={produto.nome} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{produto.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[produto.marca, produto.sku].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">
            {formatBRL(produto.preco)}
          </span>
          {produto.emOferta ? (
            <Badge className="bg-emerald-600 text-white">
              <Tag className="size-3" />
              Oferta
            </Badge>
          ) : null}
          {produto.disponivel !== null ? (
            <Badge
              variant={produto.disponivel > 0 ? "secondary" : "destructive"}
            >
              {produto.disponivel > 0
                ? `${formatarQuantidade(produto.disponivel)} disp.`
                : "Sem estoque"}
            </Badge>
          ) : null}
        </div>
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          {conteudo}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</div>
      )}
      {acao}
    </div>
  );
}

export function LeitorDeCodigo({
  aberto,
  onFechar,
  onLer,
}: {
  aberto: boolean;
  onFechar: () => void;
  onLer: (codigo: string) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ler código de barras</DialogTitle>
        </DialogHeader>
        {aberto ? (
          <BarcodeScanner
            onDetect={(codigo) => {
              onLer(codigo);
              onFechar();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Busca usada pela tela de produtos e pelo carrinho do pedido. */
export function BuscaDeProdutos({
  customerId,
  apenasOfertas = false,
  hrefDoProduto,
  acaoDoProduto,
}: {
  customerId: string | null;
  apenasOfertas?: boolean;
  hrefDoProduto?: (id: string) => string;
  acaoDoProduto?: (produto: ProdutoDaLista) => React.ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const [lendo, setLendo] = useState(false);
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const consulta = useProdutosFv({
    busca: buscaAtrasada,
    customerId,
    apenasOfertas,
  });
  const produtos =
    consulta.data?.pages.flatMap((pagina) => pagina.produtos) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Nome, código ou marca"
            className="pl-9"
            inputMode="search"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLendo(true)}
          aria-label="Ler código de barras"
        >
          <ScanBarcode className="size-5" />
        </Button>
      </div>

      {consulta.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((linha) => (
            <Skeleton key={linha} className="h-20" />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <Vazio>
          {apenasOfertas
            ? "Nenhum produto em oferta agora."
            : "Nenhum produto encontrado."}
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {produtos.map((produto) => (
            <li key={produto.id}>
              <CartaoDeProduto
                produto={produto}
                href={hrefDoProduto?.(produto.id)}
                acao={acaoDoProduto?.(produto)}
              />
            </li>
          ))}
        </ul>
      )}

      {consulta.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => consulta.fetchNextPage()}
          disabled={consulta.isFetchingNextPage}
        >
          {consulta.isFetchingNextPage ? <Spinner /> : "Carregar mais"}
        </Button>
      ) : null}

      <LeitorDeCodigo
        aberto={lendo}
        onFechar={() => setLendo(false)}
        onLer={setBusca}
      />
    </div>
  );
}

function ClienteNoContexto({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { data } = useClienteFv(customerId);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">
        Preços de <strong>{data?.nome ?? "…"}</strong>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Ver preço sem cliente"
        onClick={() => router.replace("/forca-de-vendas/produtos")}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function TelaDeProdutos() {
  const params = useSearchParams();
  const customerId = params.get("cliente");
  const sufixo = customerId ? `?cliente=${customerId}` : "";
  return (
    <FvPagina titulo="Produtos">
      {customerId ? <ClienteNoContexto customerId={customerId} /> : null}
      <BuscaDeProdutos
        customerId={customerId}
        hrefDoProduto={(id) => `/forca-de-vendas/produtos/${id}${sufixo}`}
      />
    </FvPagina>
  );
}

export function FichaDoProduto({ productId }: { productId: string }) {
  const params = useSearchParams();
  const customerId = params.get("cliente");
  const {
    data: produto,
    isPending,
    error,
  } = useProdutoFv(productId, customerId);
  const voltar = `/forca-de-vendas/produtos${customerId ? `?cliente=${customerId}` : ""}`;

  if (isPending) {
    return (
      <FvPagina titulo="Produto" voltarPara={voltar}>
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-32" />
      </FvPagina>
    );
  }
  if (!produto) {
    return (
      <FvPagina titulo="Produto" voltarPara={voltar}>
        <Vazio>{error?.message ?? "Produto não encontrado."}</Vazio>
      </FvPagina>
    );
  }

  const imagem = produto.imagens[0] ? constructUrl(produto.imagens[0]) : "";
  const estoque = produto.estoque;
  const cubagem = produto.cubagem;

  return (
    <FvPagina titulo={produto.nome} voltarPara={voltar}>
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {imagem ? (
          // biome-ignore lint/performance/noImgElement: imagem do produto no R2
          <img
            src={imagem}
            alt={produto.nome}
            className="size-full object-contain"
          />
        ) : (
          <Package className="size-10 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {[
            produto.marca,
            produto.categoria,
            produto.sku && `SKU ${produto.sku}`,
            produto.codigoDeBarras,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {formatBRL(produto.preco)}
          </span>
          <span className="text-sm text-muted-foreground">
            /{produto.unidade.toLowerCase()}{" "}
            {customerId ? "· tabela do cliente" : "· tabela padrão"}
          </span>
        </div>
        {produto.unidadesPorCaixa ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            Caixa com {produto.unidadesPorCaixa}:{" "}
            {formatBRL(
              (produto.precoNaCaixa ?? produto.preco) *
                produto.unidadesPorCaixa,
            )}
            {produto.precoNaCaixa && produto.precoNaCaixa < produto.preco
              ? ` (${formatBRL(produto.precoNaCaixa)}/un na caixa fechada)`
              : ""}
          </p>
        ) : null}
        {produto.emOferta ? (
          <Badge className="w-fit bg-emerald-600 text-white">
            <Tag className="size-3" />
            Em oferta · preço base {formatBRL(produto.precoBase)}
          </Badge>
        ) : null}
      </div>

      {customerId ? (
        <Button asChild>
          <Link
            href={`/forca-de-vendas/pedidos/novo?cliente=${customerId}&produto=${produto.id}`}
          >
            Adicionar ao pedido
          </Link>
        </Button>
      ) : null}

      {estoque ? (
        <Secao titulo="Estoque">
          <Linha
            rotulo="Disponível para vender"
            valor={formatarQuantidade(estoque.disponivel)}
            destaque={estoque.disponivel > 0 ? "ok" : "erro"}
          />
          <Linha
            rotulo="Em pedidos não faturados"
            valor={formatarQuantidade(estoque.comprometido)}
          />
          <Linha
            rotulo="Saldo físico"
            valor={formatarQuantidade(estoque.fisico)}
          />
          {estoque.filiais.length > 0 ? (
            <ul className="mt-1 flex flex-col divide-y">
              {estoque.filiais.map((filial) => (
                <li
                  key={filial.codigo}
                  className="flex justify-between gap-2 py-1.5 text-sm"
                >
                  <span>{filial.nome ?? `Filial ${filial.codigo}`}</span>
                  <span
                    className={
                      filial.quantidade > 0
                        ? "tabular-nums"
                        : "text-destructive tabular-nums"
                    }
                  >
                    {filial.quantidade > 0
                      ? formatarQuantidade(filial.quantidade)
                      : "sem estoque"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {!estoque.controlaEstoque ? (
            <p className="text-xs text-muted-foreground">
              Este produto não controla estoque.
            </p>
          ) : null}
        </Secao>
      ) : null}

      {temCubagem(cubagem) ? (
        <Secao titulo="Logística e cubagem">
          {cubagem.unidade ? (
            <Linha
              rotulo="Unidade"
              valor={`${cubagem.unidade.larguraCm} × ${cubagem.unidade.alturaCm} × ${cubagem.unidade.profundidadeCm} cm · ${cubagem.unidade.m3.toFixed(4)} m³`}
            />
          ) : null}
          {cubagem.pesoUnidadeKg ? (
            <Linha
              rotulo="Peso da unidade"
              valor={`${cubagem.pesoUnidadeKg.toLocaleString("pt-BR")} kg`}
            />
          ) : null}
          {cubagem.caixa ? (
            <Linha
              rotulo={`Caixa com ${cubagem.caixa.quantidade}`}
              valor={`${cubagem.caixa.larguraCm} × ${cubagem.caixa.alturaCm} × ${cubagem.caixa.profundidadeCm} cm · ${cubagem.caixa.m3.toFixed(4)} m³`}
            />
          ) : null}
          {cubagem.pesoCaixaKg ? (
            <Linha
              rotulo="Peso da caixa (estimado)"
              valor={`${cubagem.pesoCaixaKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`}
            />
          ) : null}
        </Secao>
      ) : null}

      {customerId ? (
        <Secao titulo="Este cliente comprou">
          {produto.comprasDoCliente.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não comprou este produto.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {produto.comprasDoCliente.map((compra) => (
                <li
                  key={`${compra.numero}-${compra.data}`}
                  className="flex justify-between gap-2 py-1.5 text-sm"
                >
                  <span>
                    {formatarData(compra.data)} ·{" "}
                    {formatarQuantidade(compra.quantidade)} un
                  </span>
                  <span className="tabular-nums">
                    {formatBRL(compra.precoUnitario)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      ) : null}

      <Secao titulo="Giro">
        <Linha
          rotulo="Vendido nos últimos 30 dias"
          valor={formatarQuantidade(produto.vendido30Dias)}
        />
        {produto.fornecedor ? (
          <Linha rotulo="Fornecedor" valor={produto.fornecedor} />
        ) : null}
      </Secao>

      {produto.descricao ? (
        <Secao titulo="Descrição">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {produto.descricao}
          </p>
        </Secao>
      ) : null}
    </FvPagina>
  );
}
