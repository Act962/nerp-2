"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Conversa } from "@/features/whatsapp-chat/components/conversa";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAbrirConversaFv, useConversasFv } from "../hooks/use-forca-vendas";
import { formatarDataHora } from "../lib/formatar";
import { FvPagina, Vazio } from "./fv-pagina";

export function ListaDeConversas() {
  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const consulta = useConversasFv(buscaAtrasada);
  const conversas =
    consulta.data?.pages.flatMap((pagina) => pagina.conversas) ?? [];

  return (
    <FvPagina titulo="Mensagens">
      <p className="text-xs text-muted-foreground">
        Conversas dos seus clientes pelo WhatsApp oficial da empresa.
      </p>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Nome ou telefone"
          className="pl-9"
        />
      </div>
      {consulta.isPending ? (
        <Skeleton className="h-40" />
      ) : conversas.length === 0 ? (
        <Vazio>
          Nenhuma conversa com clientes da sua carteira ainda. Quando um cliente
          escrever para o número da empresa, a conversa aparece aqui.
        </Vazio>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {conversas.map((conversa) => (
            <li key={conversa.id}>
              <Link
                href={`/forca-de-vendas/mensagens/${conversa.id}`}
                className="flex items-center gap-3 p-3 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{conversa.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {conversa.previa?.fromMe ? "Você: " : ""}
                    {conversa.previa?.corpo ??
                      (conversa.previa?.tipoDeMidia ? "Mídia" : "")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(conversa.ultimaEm)}
                  </span>
                  {conversa.naoLidas > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                      {conversa.naoLidas}
                    </span>
                  ) : null}
                </div>
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

export function TelaDeConversa({ conversationId }: { conversationId: string }) {
  const { data, isPending, error } = useAbrirConversaFv(conversationId);
  return (
    <FvPagina
      titulo={data?.nome ?? "Conversa"}
      voltarPara="/forca-de-vendas/mensagens"
    >
      {isPending ? (
        <Skeleton className="h-96" />
      ) : !data ? (
        <Vazio>{error?.message ?? "Conversa não encontrada."}</Vazio>
      ) : (
        // A mesma tela de conversa do Atendimento: janela de 24 h, mídia,
        // templates e cobrança em ★ vêm junto.
        <div className="flex h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-xl border">
          <Conversa conversationId={data.id} nome={data.nome} />
        </div>
      )}
    </FvPagina>
  );
}
