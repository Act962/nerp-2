"use client";

import { Button } from "@/components/ui/button";
import { isChunkLoadError, tryReloadOnce } from "@/lib/client-error";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Tela de erro do cliente.
 *
 * Existe por dois motivos. Primeiro, sem nenhum error boundary o Next pinta a
 * página inteira de branco com "Application error: a client-side exception has
 * occurred" — texto genérico que não diz nada a quem está no caixa nem a quem
 * vai depurar. Segundo, o `digest` e a mensagem real só chegam aqui: em
 * produção a stack vem minificada, e este é o único lugar onde dá para mostrar
 * ao operador algo que ele consiga repassar ao suporte.
 */
export function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const chunk = isChunkLoadError(error);
  const [recarregando, setRecarregando] = useState(false);

  useEffect(() => {
    // Chunk velho depois de deploy: recarrega sozinho, o operador não deveria
    // precisar saber o que é um chunk.
    if (chunk && tryReloadOnce()) setRecarregando(true);
  }, [chunk]);

  useEffect(() => {
    // Sem serviço de erro configurado, o console é o único registro. Fica
    // explícito e não minificado no `message`.
    console.error("[nerp] erro de cliente", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  if (recarregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Atualizando para a versão nova do sistema...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Algo quebrou nesta tela</h1>
          <p className="text-sm text-muted-foreground">
            {chunk
              ? "O sistema foi atualizado enquanto esta aba estava aberta. Recarregue para continuar."
              : "A venda em andamento não foi perdida. Tente de novo; se insistir, recarregue a página."}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {reset && (
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="size-4" />
              Tentar de novo
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Recarregar
          </Button>
        </div>

        {/* O que o operador lê para o suporte. Sem isso, o chamado chega como
            "deu erro" e não há por onde começar. */}
        <div className="rounded border bg-muted/40 p-3 text-left">
          <p className="text-xs font-medium text-muted-foreground">
            Informe ao suporte:
          </p>
          <p className="mt-1 break-words font-mono text-xs">
            {error.message || error.name || "erro sem mensagem"}
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              digest: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
