"use client";

import {
  AlertTriangle,
  ChevronRight,
  LogIn,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useCarteiraFv,
  useClienteFv,
  useConversaDoClienteFv,
  useVisitaAbertaFv,
} from "../hooks/use-forca-vendas";
import {
  formatarData,
  formatarDiasSemComprar,
  formatBRL,
  linkComoChegar,
  linkWhatsapp,
} from "../lib/formatar";
import { FvPagina, Linha, Secao, Vazio } from "./fv-pagina";
import { CheckinDialog } from "./rota";

export function ListaDeClientes() {
  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const consulta = useCarteiraFv(buscaAtrasada);
  const clientes =
    consulta.data?.pages.flatMap((pagina) => pagina.clientes) ?? [];

  return (
    <FvPagina titulo="Clientes">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Nome, fantasia, CNPJ ou cidade"
          className="pl-9"
          inputMode="search"
        />
      </div>

      {consulta.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((linha) => (
            <Skeleton key={linha} className="h-20" />
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <Vazio>
          {busca
            ? "Nenhum cliente da sua carteira bate com a busca."
            : "Sua carteira ainda está vazia. O gestor atribui os clientes em Força de Vendas → Carteiras."}
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/forca-de-vendas/clientes/${cliente.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cliente.nome}</p>
                  {cliente.cidade ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {cliente.cidade}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {cliente.vencido > 0 ? (
                      <Badge variant="destructive">
                        Vencido {formatBRL(cliente.vencido)}
                      </Badge>
                    ) : null}
                    {cliente.bloqueado ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : null}
                    <Badge variant="secondary">
                      {formatarDiasSemComprar(cliente.diasSemComprar)}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
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
    </FvPagina>
  );
}

export function FichaDoCliente({ customerId }: { customerId: string }) {
  const { data: cliente, isPending, error } = useClienteFv(customerId);
  const { data: conversa } = useConversaDoClienteFv(customerId);
  const { data: visita } = useVisitaAbertaFv();
  const [fazendoCheckin, setFazendoCheckin] = useState(false);

  if (isPending) {
    return (
      <FvPagina titulo="Cliente" voltarPara="/forca-de-vendas/clientes">
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </FvPagina>
    );
  }
  if (!cliente) {
    return (
      <FvPagina titulo="Cliente" voltarPara="/forca-de-vendas/clientes">
        <Vazio>{error?.message ?? "Cliente não encontrado."}</Vazio>
      </FvPagina>
    );
  }

  const comoChegar = linkComoChegar({
    latitude: cliente.localizacao?.latitude,
    longitude: cliente.localizacao?.longitude,
    endereco: cliente.endereco,
  });
  const financeiro = cliente.financeiro;

  return (
    <FvPagina titulo={cliente.nome} voltarPara="/forca-de-vendas/clientes">
      <div className="flex flex-col gap-1">
        {cliente.razaoSocial !== cliente.nome ? (
          <p className="text-sm text-muted-foreground">{cliente.razaoSocial}</p>
        ) : null}
        {cliente.documento ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {cliente.documento}
          </p>
        ) : null}
        {cliente.endereco ? (
          <p className="flex items-start gap-1 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {cliente.endereco}
          </p>
        ) : null}
      </div>

      {cliente.bloqueado || financeiro.vencido > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {cliente.bloqueado
              ? `Cliente bloqueado${cliente.motivoBloqueio ? `: ${cliente.motivoBloqueio}` : ""}. `
              : ""}
            {financeiro.vencido > 0
              ? `${formatBRL(financeiro.vencido)} vencidos em ${financeiro.titulosVencidos} título(s). `
              : ""}
            O pedido vai para aprovação.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button asChild className="col-span-2 sm:col-span-4">
          <Link href={`/forca-de-vendas/pedidos/novo?cliente=${cliente.id}`}>
            <Plus className="size-4" />
            Novo pedido
          </Link>
        </Button>
        {visita?.cliente.id === cliente.id ? (
          <Button
            variant="secondary"
            className="col-span-2 sm:col-span-4"
            asChild
          >
            <Link href="/forca-de-vendas/rota">
              Em visita · fazer check-out na Rota
            </Link>
          </Button>
        ) : !visita ? (
          <Button
            variant="outline"
            className="col-span-2 sm:col-span-4"
            onClick={() => setFazendoCheckin(true)}
          >
            <LogIn className="size-4" />
            Check-in neste cliente
          </Button>
        ) : null}
        {cliente.telefone ? (
          <Button variant="outline" asChild>
            <a href={`tel:${cliente.telefone}`}>
              <Phone className="size-4" />
              Ligar
            </a>
          </Button>
        ) : null}
        {conversa?.conversationId ? (
          <Button variant="outline" asChild>
            <Link
              href={`/forca-de-vendas/mensagens/${conversa.conversationId}`}
            >
              <MessageCircle className="size-4" />
              Conversa
            </Link>
          </Button>
        ) : cliente.telefone ? (
          <Button variant="outline" asChild>
            <a
              href={linkWhatsapp(cliente.telefone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {comoChegar ? (
          <Button variant="outline" asChild>
            <a href={comoChegar} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" />
              Como chegar
            </a>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={`/forca-de-vendas/produtos?cliente=${cliente.id}`}>
            <Search className="size-4" />
            Produtos
          </Link>
        </Button>
      </div>

      <Secao titulo="Crédito e financeiro">
        <Linha
          rotulo="Limite disponível"
          valor={
            financeiro.limiteDisponivel === null
              ? "Sem controle de limite"
              : formatBRL(financeiro.limiteDisponivel)
          }
          destaque={
            financeiro.limiteDisponivel !== null &&
            financeiro.limiteDisponivel < 0
              ? "erro"
              : undefined
          }
        />
        {financeiro.limiteCredito !== null ? (
          <Linha
            rotulo="Limite total"
            valor={formatBRL(financeiro.limiteCredito)}
          />
        ) : null}
        <Linha rotulo="Em aberto" valor={formatBRL(financeiro.emAberto)} />
        <Linha
          rotulo="Vencido"
          valor={formatBRL(financeiro.vencido)}
          destaque={financeiro.vencido > 0 ? "erro" : "ok"}
        />
        {financeiro.vencimentoMaisAntigo ? (
          <Linha
            rotulo="Vencimento mais antigo"
            valor={formatarData(financeiro.vencimentoMaisAntigo)}
          />
        ) : null}
        <Linha
          rotulo="Pedidos não faturados"
          valor={financeiro.pedidosEmAberto}
        />
      </Secao>

      <Secao titulo="Compras">
        <Linha
          rotulo="Última compra"
          valor={formatarDiasSemComprar(cliente.diasSemComprar)}
        />
        <Linha
          rotulo="Ticket médio"
          valor={
            cliente.ticketMedio === null ? "—" : formatBRL(cliente.ticketMedio)
          }
        />
        {cliente.tabelaDePreco ? (
          <Linha rotulo="Tabela de preço" valor={cliente.tabelaDePreco} />
        ) : null}
        {cliente.ultimasCompras.length > 0 ? (
          <ul className="mt-1 flex flex-col divide-y">
            {cliente.ultimasCompras.map((compra) => (
              <li
                key={compra.saleId}
                className="flex justify-between gap-2 py-2 text-sm"
              >
                <span>
                  #{compra.numero} · {formatarData(compra.data)}
                  <span className="text-muted-foreground">
                    {" "}
                    · {compra.itens} itens
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatBRL(compra.total)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      {cliente.titulos.length > 0 ? (
        <Secao titulo="Títulos em aberto">
          <ul className="flex flex-col divide-y">
            {cliente.titulos.map((titulo) => (
              <li
                key={titulo.id}
                className="flex justify-between gap-2 py-2 text-sm"
              >
                <span
                  className={titulo.vencido ? "text-destructive" : undefined}
                >
                  {formatarData(titulo.vencimento)}
                  {titulo.numeroDaVenda
                    ? ` · venda #${titulo.numeroDaVenda}`
                    : ""}
                </span>
                <span className="font-medium tabular-nums">
                  {formatBRL(titulo.valor - titulo.valorPago)}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <CheckinDialog
        cliente={fazendoCheckin ? { id: cliente.id, nome: cliente.nome } : null}
        onFechar={() => setFazendoCheckin(false)}
      />

      <Secao titulo="Cadastro">
        {cliente.telefone ? (
          <Linha rotulo="Telefone" valor={cliente.telefone} />
        ) : null}
        {cliente.email ? <Linha rotulo="E-mail" valor={cliente.email} /> : null}
        {cliente.aniversario ? (
          <Linha
            rotulo="Aniversário"
            valor={formatarData(cliente.aniversario)}
          />
        ) : null}
        {cliente.segmento ? (
          <Linha rotulo="Segmento" valor={cliente.segmento} />
        ) : null}
        <Linha
          rotulo="Vendedores"
          valor={
            cliente.vendedores.length > 0
              ? cliente.vendedores.map((vendedor) => vendedor.nome).join(", ")
              : "—"
          }
        />
        {cliente.observacoes ? (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {cliente.observacoes}
          </p>
        ) : null}
      </Secao>
    </FvPagina>
  );
}
