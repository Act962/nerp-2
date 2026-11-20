"use client";

import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  useCarteiraFv,
  useClienteFv,
  useCondicoesFv,
  useEnviarPedidoFv,
  useProdutoFv,
  useSimularPedidoFv,
  useVisitaAbertaFv,
} from "../hooks/use-forca-vendas";
import { descreverPrazos } from "../lib/parcelas";
import { formatarQuantidade, formatBRL } from "../lib/formatar";
import { escreverDecimal, lerDecimal, obterPosicao } from "../lib/posicao";
import type { TipoPedido } from "../lib/regras-pedido";
import { FvPagina, Linha, Secao, Vazio } from "./fv-pagina";
import { MotivosDeAprovacao } from "./pedidos";
import { BuscaDeProdutos, Miniatura } from "./produtos";

type ItemDoCarrinho = {
  productId: string;
  nome: string;
  imagem: string | null;
  quantidade: number;
  /** Texto do campo de preço; vazio = preço de tabela. */
  preco: string;
};

const TIPOS: Array<{ valor: TipoPedido; rotulo: string }> = [
  { valor: "VENDA", rotulo: "Venda" },
  { valor: "ORCAMENTO", rotulo: "Orçamento" },
  { valor: "BONIFICACAO", rotulo: "Bonificação" },
  { valor: "TROCA", rotulo: "Troca" },
];

function EscolherCliente({ onEscolher }: { onEscolher: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const consulta = useCarteiraFv(buscaAtrasada);
  const clientes =
    consulta.data?.pages.flatMap((pagina) => pagina.clientes) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Para qual cliente?"
          className="pl-9"
          autoFocus
        />
      </div>
      {consulta.isPending ? (
        <Skeleton className="h-32" />
      ) : clientes.length === 0 ? (
        <Vazio>Nenhum cliente da carteira encontrado.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                onClick={() => onEscolher(cliente.id)}
                className="w-full rounded-xl border bg-card p-3 text-left hover:bg-accent"
              >
                <span className="block font-medium">{cliente.nome}</span>
                {cliente.cidade ? (
                  <span className="block text-xs text-muted-foreground">
                    {cliente.cidade}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Produto vindo de `?produto=` (botão "Adicionar ao pedido" da ficha). */
function useProdutoInicial(
  productId: string | null,
  customerId: string,
  adicionar: (item: Omit<ItemDoCarrinho, "quantidade" | "preco">) => void,
) {
  const { data } = useProdutoFv(productId ?? "", customerId);
  const feito = useRef(false);
  useEffect(() => {
    if (!productId || !data || feito.current) return;
    feito.current = true;
    adicionar({ productId: data.id, nome: data.nome, imagem: data.imagem });
  }, [productId, data, adicionar]);
}

function MontarPedido({ customerId }: { customerId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: cliente } = useClienteFv(customerId);
  const { data: condicoes = [] } = useCondicoesFv();
  const { data: visita } = useVisitaAbertaFv();
  const simular = useSimularPedidoFv();
  const enviar = useEnviarPedidoFv();
  // Um id por rascunho: reenviar depois de uma falha de rede não duplica o pedido.
  const [clientOperationId] = useState(() => crypto.randomUUID());
  const [itens, setItens] = useState<ItemDoCarrinho[]>([]);
  const [tipo, setTipo] = useState<TipoPedido>("VENDA");
  const [condicaoId, setCondicaoId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [buscando, setBuscando] = useState(false);

  const adicionar = useRef(
    (item: Omit<ItemDoCarrinho, "quantidade" | "preco">) => {
      setItens((atual) => {
        const existente = atual.find(
          (linha) => linha.productId === item.productId,
        );
        if (existente) {
          return atual.map((linha) =>
            linha.productId === item.productId
              ? { ...linha, quantidade: linha.quantidade + 1 }
              : linha,
          );
        }
        return [...atual, { ...item, quantidade: 1, preco: "" }];
      });
    },
  ).current;
  useProdutoInicial(params.get("produto"), customerId, adicionar);

  const condicaoEscolhida = condicaoId ?? condicoes[0]?.id ?? null;
  const entrada = {
    customerId,
    tipo,
    condicaoPagamentoId: condicaoEscolhida,
    visitaId: visita && visita.cliente.id === customerId ? visita.id : null,
    observacao: observacao || null,
    itens: itens.map((item) => ({
      productId: item.productId,
      quantidade: item.quantidade,
      precoUnitario: lerDecimal(item.preco),
    })),
  };
  const chave = JSON.stringify(entrada);
  const chaveAtrasada = useDebouncedValue(chave, 400);
  const { mutate: simularPedido } = simular;
  // A mutation zera `data` enquanto recalcula; guardar o último resultado
  // evita o resumo piscar a cada tecla digitada no preço.
  const [previa, setPrevia] = useState<typeof simular.data>(undefined);

  // Simula no servidor a cada mudança: preço de tabela, flex e aprovação são
  // a mesma conta que o envio faz.
  useEffect(() => {
    const atual = JSON.parse(chaveAtrasada) as typeof entrada;
    if (atual.itens.length === 0) {
      setPrevia(undefined);
      return;
    }
    simularPedido(atual, { onSuccess: setPrevia });
  }, [chaveAtrasada, simularPedido]);

  const previaPorProduto = new Map(
    previa?.itens.map((item) => [item.productId, item]),
  );

  async function enviarPedido() {
    const posicao = await obterPosicao(4000);
    enviar.mutate(
      {
        ...entrada,
        clientOperationId,
        latitude: posicao?.latitude ?? null,
        longitude: posicao?.longitude ?? null,
      },
      {
        onSuccess: (resultado) =>
          router.replace(`/forca-de-vendas/pedidos/${resultado.saleId}`),
      },
    );
  }

  const semValor = tipo === "BONIFICACAO" || tipo === "TROCA";

  return (
    <FvPagina titulo="Novo pedido" voltarPara="/forca-de-vendas/pedidos">
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {cliente?.nome ?? "…"}
          </span>
          {cliente && cliente.financeiro.limiteDisponivel !== null ? (
            <span className="block text-xs text-muted-foreground tabular-nums">
              Limite disponível {formatBRL(cliente.financeiro.limiteDisponivel)}
            </span>
          ) : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace("/forca-de-vendas/pedidos/novo")}
        >
          Trocar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={tipo}
          onValueChange={(valor) => setTipo(valor as TipoPedido)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((opcao) => (
              <SelectItem key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={condicaoEscolhida ?? ""}
          onValueChange={setCondicaoId}
          disabled={condicoes.length === 0 || semValor}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sem condição" />
          </SelectTrigger>
          <SelectContent>
            {condicoes.map((condicao) => (
              <SelectItem key={condicao.id} value={condicao.id}>
                {condicao.nome} · {descreverPrazos(condicao.prazosDias)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {itens.length === 0 ? (
        <Vazio>Adicione os produtos do pedido.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((item) => {
            const calculo = previaPorProduto.get(item.productId);
            const acimaDoEstoque =
              calculo?.disponivel != null &&
              item.quantidade > calculo.disponivel;
            return (
              <li
                key={item.productId}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3"
              >
                <div className="flex items-start gap-3">
                  <Miniatura chave={item.imagem} nome={item.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">
                      {item.nome}
                    </p>
                    {calculo ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Tabela {formatBRL(calculo.precoTabela)}
                        {calculo.descontoPercent !== 0 && !semValor
                          ? ` · ${calculo.descontoPercent > 0 ? "desconto" : "acima"} ${Math.abs(calculo.descontoPercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                          : ""}
                      </p>
                    ) : null}
                    {acimaDoEstoque ? (
                      <p className="text-xs text-amber-700">
                        Só {formatarQuantidade(calculo.disponivel ?? 0)}{" "}
                        disponíveis
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Remover"
                    onClick={() =>
                      setItens((atual) =>
                        atual.filter(
                          (linha) => linha.productId !== item.productId,
                        ),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label="Menos"
                      onClick={() =>
                        setItens((atual) =>
                          atual.map((linha) =>
                            linha.productId === item.productId
                              ? {
                                  ...linha,
                                  quantidade: Math.max(1, linha.quantidade - 1),
                                }
                              : linha,
                          ),
                        )
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      value={String(item.quantidade)}
                      inputMode="decimal"
                      className="h-9 w-14 border-0 text-center tabular-nums shadow-none"
                      onChange={(event) => {
                        const valor = lerDecimal(event.target.value);
                        setItens((atual) =>
                          atual.map((linha) =>
                            linha.productId === item.productId &&
                            valor !== null &&
                            valor > 0
                              ? { ...linha, quantidade: valor }
                              : linha,
                          ),
                        );
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label="Mais"
                      onClick={() =>
                        setItens((atual) =>
                          atual.map((linha) =>
                            linha.productId === item.productId
                              ? { ...linha, quantidade: linha.quantidade + 1 }
                              : linha,
                          ),
                        )
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      value={semValor ? "0,00" : item.preco}
                      disabled={semValor}
                      placeholder={
                        calculo
                          ? escreverDecimal(calculo.precoTabela)
                          : "Tabela"
                      }
                      inputMode="decimal"
                      className="h-9 pl-9 text-right tabular-nums"
                      onChange={(event) =>
                        setItens((atual) =>
                          atual.map((linha) =>
                            linha.productId === item.productId
                              ? { ...linha, preco: event.target.value }
                              : linha,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="outline" onClick={() => setBuscando(true)}>
        <Plus className="size-4" />
        Adicionar produto
      </Button>

      <Textarea
        value={observacao}
        onChange={(event) => setObservacao(event.target.value)}
        placeholder="Observação para o escritório (opcional)"
        rows={2}
      />

      {previa ? (
        <Secao titulo="Resumo">
          <Linha rotulo="Total" valor={formatBRL(previa.total)} />
          {tipo === "VENDA" ? (
            <>
              <Linha
                rotulo="Flex deste pedido"
                valor={formatBRL(previa.flex)}
                destaque={
                  previa.flex < 0 ? "erro" : previa.flex > 0 ? "ok" : undefined
                }
              />
              <Linha
                rotulo="Saldo flex depois"
                valor={formatBRL(previa.saldoFlexPrevisto)}
              />
            </>
          ) : null}
        </Secao>
      ) : null}
      {previa ? <MotivosDeAprovacao motivos={previa.motivos} /> : null}

      <Button
        size="lg"
        disabled={itens.length === 0 || enviar.isPending}
        onClick={enviarPedido}
        className={cn("sticky bottom-4")}
      >
        {tipo === "ORCAMENTO"
          ? "Salvar orçamento"
          : previa && previa.motivos.length > 0
            ? "Enviar para aprovação"
            : "Enviar pedido"}
      </Button>

      <Sheet open={buscando} onOpenChange={setBuscando}>
        <SheetContent
          side="bottom"
          className="h-[90dvh] overflow-y-auto px-4 pb-6"
        >
          <SheetHeader className="px-0">
            <SheetTitle>Adicionar produto</SheetTitle>
          </SheetHeader>
          <BuscaDeProdutos
            customerId={customerId}
            acaoDoProduto={(produto) => (
              <Button
                size="icon"
                aria-label={`Adicionar ${produto.nome}`}
                onClick={() =>
                  adicionar({
                    productId: produto.id,
                    nome: produto.nome,
                    imagem: produto.imagem,
                  })
                }
              >
                <Plus className="size-4" />
              </Button>
            )}
          />
        </SheetContent>
      </Sheet>
    </FvPagina>
  );
}

export function NovoPedido() {
  const params = useSearchParams();
  const router = useRouter();
  const customerId = params.get("cliente");
  if (!customerId) {
    return (
      <FvPagina titulo="Novo pedido" voltarPara="/forca-de-vendas/pedidos">
        <EscolherCliente
          onEscolher={(id) =>
            router.replace(`/forca-de-vendas/pedidos/novo?cliente=${id}`)
          }
        />
      </FvPagina>
    );
  }
  return <MontarPedido key={customerId} customerId={customerId} />;
}
