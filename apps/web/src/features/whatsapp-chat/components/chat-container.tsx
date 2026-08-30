"use client";

import { Loader2, MessageCircle, Plug } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PainelDoCliente } from "@/features/crm/components/painel-do-cliente";
import { useFunnels } from "@/features/crm/hooks/use-funnels";
import { cn } from "@/lib/utils";
import { useConversas } from "../hooks/use-chat";
import { useChatRealtime } from "../hooks/use-chat-realtime";
import { Conversa } from "./conversa";
import { ListaDeConversas } from "./lista-de-conversas";

/**
 * A tela de atendimento: funil, lista de conversas e a conversa aberta.
 *
 * Funil e conversa vivem na URL (`?funil=` e `?conversa=`), não em estado
 * local: assim o atendente manda o link de uma conversa para um colega, e um
 * F5 no meio do atendimento não perde o lugar.
 */
export function ChatContainer() {
  const { data: dadosDeFunis, isPending: carregandoFunis } = useFunnels();
  const [funnelId, setFunnelId] = useQueryState("funil");
  const [conversationId, setConversationId] = useQueryState("conversa");

  const funis = dadosDeFunis?.funis ?? [];

  useEffect(() => {
    if (!funnelId && funis.length > 0) setFunnelId(funis[0]?.id ?? null);
  }, [funnelId, funis, setFunnelId]);

  useChatRealtime({ funnelId, conversationId });

  const { data: dadosDeConversas } = useConversas({ funnelId });
  const conversas =
    dadosDeConversas?.pages.flatMap((pagina) => pagina.conversas) ?? [];
  const aberta = conversas.find((conversa) => conversa.id === conversationId);
  // Só considera aberta a conversa que existe na lista: um `?conversa=` de
  // outro funil, colado na URL, não deve esconder a lista no celular.
  const conversaAberta = aberta ? conversationId : null;

  if (carregandoFunis) {
    return (
      <div className="flex flex-1 items-center gap-2 p-6 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  const funilAtual = funis.find((funil) => funil.id === funnelId);
  const semNumero = funilAtual && !funilAtual.whatsapp;

  if (funis.length === 0) {
    return (
      <VazioComAcao
        titulo="Nenhum funil ainda"
        texto="O atendimento acontece dentro de um funil. Crie o primeiro na tela de conexão e ligue um número a ele."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Select
          value={funnelId ?? undefined}
          onValueChange={(valor) => {
            setFunnelId(valor);
            // Conversa é de um funil só: trocar de funil sem limpar deixaria
            // a tela mostrando uma conversa que não pertence à lista.
            setConversationId(null);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione o funil" />
          </SelectTrigger>
          <SelectContent>
            {funis.map((funil) => (
              <SelectItem key={funil.id} value={funil.id}>
                {funil.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {semNumero ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>Este funil ainda não tem número conectado.</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/whatsapp/conexao?funil=${funnelId}`}>
                <Plug className="size-4" />
                Conectar
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Três colunas em tela grande: conversas, conversa e a ficha do cliente.
          Em telas médias a ficha sai; no celular fica um painel por vez.
          A troca no celular é por CSS, não por renderizar de novo: montar a
          conversa em dois lugares faria tudo em dobro — duas consultas de
          mensagem, dois "marcar como lida", dois canais de tempo real. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px]">
        <div
          className={cn(
            "min-h-0",
            // No celular a lista some quando há conversa aberta.
            conversaAberta && "max-lg:hidden",
          )}
        >
          <ListaDeConversas
            funnelId={funnelId}
            conversaAberta={conversationId}
            aoEscolher={(id) => setConversationId(id)}
          />
        </div>

        <div className={cn("min-h-0", !conversaAberta && "max-lg:hidden")}>
          {conversaAberta && aberta ? (
            <Conversa conversationId={conversaAberta} nome={aberta.nome} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageCircle className="size-10 opacity-40" />
              <p className="text-sm">Escolha uma conversa para começar.</p>
            </div>
          )}
        </div>

        <div className="min-h-0 max-xl:hidden">
          {aberta ? (
            <PainelDoCliente leadId={aberta.leadId} funnelId={funnelId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VazioComAcao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="max-w-md text-muted-foreground text-sm">{texto}</p>
      </div>
      <Button asChild>
        <Link href="/whatsapp/conexao">
          <Plug className="size-4" />
          Ir para a conexão
        </Link>
      </Button>
    </div>
  );
}
