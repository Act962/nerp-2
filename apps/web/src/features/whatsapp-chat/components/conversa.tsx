"use client";

import {
  AlertTriangle,
  Check,
  CheckCheck,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEnviarArquivo } from "../hooks/use-enviar-arquivo";
import { cn } from "@/lib/utils";
import {
  useEnviarMensagem,
  useMarcarComoLida,
  useMensagens,
} from "../hooks/use-chat";

type Mensagem = {
  id: string;
  corpo: string | null;
  fromMe: boolean;
  status: "SENT" | "DELIVERED" | "SEEN" | "FAILED" | "DELETED";
  temMidia: boolean;
  tipoDeMidia: string | null;
  mimetype: string | null;
  fileName: string | null;
  createdAt: string;
};

/** Os tiques que o atendente vê na própria mensagem. */
function Tique({ status }: { status: Mensagem["status"] }) {
  if (status === "FAILED") {
    return <X className="size-3.5 text-destructive" aria-label="Falhou" />;
  }
  if (status === "SEEN") {
    return <CheckCheck className="size-3.5 text-sky-500" aria-label="Lida" />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className="size-3.5 opacity-70" aria-label="Entregue" />;
  }
  return <Check className="size-3.5 opacity-70" aria-label="Enviada" />;
}

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  const hora = new Date(mensagem.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex w-full",
        mensagem.fromMe ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          mensagem.fromMe
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {mensagem.temMidia ? <MidiaDaMensagem mensagem={mensagem} /> : null}

        {mensagem.corpo ? (
          <p className="whitespace-pre-wrap break-words">{mensagem.corpo}</p>
        ) : null}

        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            mensagem.fromMe ? "opacity-80" : "text-muted-foreground",
          )}
        >
          <span>{hora}</span>
          {mensagem.fromMe ? <Tique status={mensagem.status} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * O arquivo vem por `/api/whatsapp/media/{id}`, que confere sessão e
 * organização antes de ler o bucket privado — a chave nunca chega ao browser.
 */
function MidiaDaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const url = `/api/whatsapp/media/${mensagem.id}`;

  if (mensagem.tipoDeMidia === "image" || mensagem.tipoDeMidia === "sticker") {
    return (
      // Imagem servida pela nossa própria rota autenticada, então <img> mesmo:
      // `next/image` exigiria hostname em `remotePatterns` e não acrescenta
      // nada aqui, onde o tamanho é variável e o cache é privado.
      // biome-ignore lint/performance/noImgElement: rota autenticada própria
      <img
        src={url}
        alt={mensagem.fileName ?? "Imagem recebida"}
        className="mb-1 max-h-64 rounded"
      />
    );
  }

  if (mensagem.tipoDeMidia === "audio") {
    // biome-ignore lint/a11y/useMediaCaption: áudio de conversa não tem legenda
    return <audio src={url} controls className="mb-1 w-56" />;
  }

  if (mensagem.tipoDeMidia === "video") {
    // biome-ignore lint/a11y/useMediaCaption: vídeo de conversa não tem legenda
    return <video src={url} controls className="mb-1 max-h-64 rounded" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-1 flex items-center gap-2 underline"
    >
      📄 {mensagem.fileName ?? "Arquivo"}
    </a>
  );
}

export function Conversa({
  conversationId,
  nome,
}: {
  conversationId: string;
  nome: string;
}) {
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMensagens(conversationId);
  const enviar = useEnviarMensagem();
  const enviarArquivo = useEnviarArquivo();
  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  const marcarComoLida = useMarcarComoLida();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  // Abrir a conversa zera o badge de não-lidas.
  const { mutate: marcar } = marcarComoLida;
  useEffect(() => {
    marcar({ conversationId });
  }, [conversationId, marcar]);

  const mensagens = (data?.pages.flatMap((pagina) => pagina.mensagens) ?? [])
    .slice()
    .reverse();

  // biome-ignore lint/correctness/useExhaustiveDependencies: rola ao chegar mensagem
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  const enviarTexto = () => {
    const corpo = texto.trim();
    if (!corpo) return;
    enviar.mutate({ conversationId, corpo }, { onSuccess: () => setTexto("") });
  };

  const janelaFechada =
    enviar.error?.message?.includes("janela de 24 horas") ?? false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="font-medium">{nome}</span>
      </header>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
        onScroll={(evento) => {
          // Histórico cresce pelo topo: carrega mais ao chegar perto dele.
          if (
            evento.currentTarget.scrollTop < 80 &&
            hasNextPage &&
            !isFetchingNextPage
          ) {
            void fetchNextPage();
          }
        }}
      >
        {isPending ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando mensagens…
          </div>
        ) : null}

        {isFetchingNextPage ? (
          <div className="flex justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {mensagens.map((mensagem) => (
          <Bolha key={mensagem.id} mensagem={mensagem} />
        ))}
        <div ref={fim} />
      </div>

      {janelaFechada ? (
        <div className="flex items-start gap-2 border-t bg-amber-50 px-4 py-3 text-amber-900 text-sm dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Passaram-se mais de 24 horas desde a última mensagem deste cliente.
            A Meta só permite reabrir a conversa com um template aprovado —
            envio de templates entra junto com as Campanhas.
          </p>
        </div>
      ) : null}

      <div className="flex items-end gap-2 border-t p-3">
        {/* O arquivo vai junto com o que estiver escrito: no WhatsApp a legenda
            é parte da mesma mensagem, não uma segunda bolha. */}
        <input
          ref={seletorDeArquivo}
          type="file"
          className="hidden"
          onChange={(evento) => {
            const arquivo = evento.target.files?.[0];
            evento.target.value = "";
            if (!arquivo) return;
            enviarArquivo.mutate(
              {
                conversationId,
                arquivo,
                legenda: texto.trim() || undefined,
              },
              { onSuccess: () => setTexto("") },
            );
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Anexar arquivo"
          disabled={janelaFechada || enviarArquivo.isPending}
          onClick={() => seletorDeArquivo.current?.click()}
        >
          {enviarArquivo.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
        <Textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter envia, Shift+Enter quebra linha — o que todo mundo espera
            // de um campo de conversa.
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              enviarTexto();
            }
          }}
          placeholder="Escreva uma mensagem"
          rows={1}
          className="max-h-32 min-h-10 resize-none"
        />
        <Button
          type="button"
          size="icon"
          onClick={enviarTexto}
          disabled={enviar.isPending || texto.trim().length === 0}
          aria-label="Enviar"
        >
          {enviar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
