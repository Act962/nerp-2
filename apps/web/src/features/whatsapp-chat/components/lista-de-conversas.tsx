"use client";

import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useConversas } from "../hooks/use-chat";

const RESUMO_POR_TIPO: Record<string, string> = {
  image: "📷 Foto",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  document: "📄 Documento",
  sticker: "Figurinha",
};

function previaDaConversa(previa: {
  corpo: string | null;
  tipoDeMidia: string | null;
  fromMe: boolean;
}): string {
  const texto =
    previa.corpo?.trim() ||
    (previa.tipoDeMidia ? RESUMO_POR_TIPO[previa.tipoDeMidia] : null) ||
    "";
  return previa.fromMe ? `Você: ${texto}` : texto;
}

function quando(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  return mesmoDia
    ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ListaDeConversas({
  funnelId,
  conversaAberta,
  aoEscolher,
}: {
  funnelId: string | null;
  conversaAberta: string | null;
  aoEscolher: (conversationId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversas({ funnelId, busca: busca.trim() || undefined });

  const conversas = data?.pages.flatMap((pagina) => pagina.conversas) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col border-r">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="pl-8"
          />
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(evento) => {
          const alvo = evento.currentTarget;
          const faltam = alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight;
          // Carrega antes de chegar ao fim, para a rolagem não travar.
          if (faltam < 120 && hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
      >
        {isPending ? (
          <div className="flex items-center gap-2 p-4 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando conversas…
          </div>
        ) : conversas.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground text-sm">
            {busca
              ? "Nenhuma conversa encontrada."
              : "Nenhuma conversa ainda. Elas aparecem aqui assim que alguém escrever para o número conectado."}
          </p>
        ) : (
          <ul>
            {conversas.map((conversa) => (
              <li key={conversa.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(conversa.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b px-3 py-3 text-left transition-colors hover:bg-accent",
                    conversaAberta === conversa.id && "bg-accent",
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-sm">
                      {conversa.nome}
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {quando(conversa.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                      {conversa.previa ? previaDaConversa(conversa.previa) : ""}
                    </span>
                    {conversa.naoLidas > 0 ? (
                      <Badge className="shrink-0 px-1.5">
                        {conversa.naoLidas}
                      </Badge>
                    ) : null}
                  </div>
                  {conversa.statusFlow === "WAITING" ? (
                    <span className="text-amber-600 text-xs dark:text-amber-500">
                      Esperando resposta
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {isFetchingNextPage ? (
          <div className="flex justify-center p-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
