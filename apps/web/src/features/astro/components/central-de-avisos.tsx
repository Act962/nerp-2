"use client";

import { AlertTriangle, Bell, Brain, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAvisos,
  useEsquecerMemoria,
  useMarcarAvisoLido,
  useMarcarTodosLidos,
  useMemorias,
} from "@/features/astro/hooks/use-avisos";
import {
  ehTipoDeAviso,
  ROTULO_DO_TIPO,
} from "@/features/astro/server/avisos/tipos";
import { cn } from "@/lib/utils";

/**
 * A central: tudo o que o Astro tem a dizer, e tudo o que ele lembra.
 *
 * As duas listas ficam na mesma tela de propósito. "Por que ele falou isso?" e
 * "o que ele sabe de mim?" são a mesma pergunta vista de dois ângulos, e
 * separá-las em duas páginas esconderia a memória de quem nunca souber que ela
 * existe.
 */
export function CentralDeAvisos() {
  const { data, isLoading } = useAvisos();
  const marcarLido = useMarcarAvisoLido();
  const marcarTodos = useMarcarTodosLidos();

  const avisos = data?.avisos ?? [];
  const naoLidos = data?.naoLidos ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4" />
              Avisos
            </CardTitle>
            <CardDescription>
              O Astro olha a operação três vezes por dia e avisa o que mudou.
              Nada disso consome Stars.
            </CardDescription>
          </div>
          {naoLidos > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => marcarTodos.mutate({})}
              disabled={marcarTodos.isPending}
            >
              Marcar todos como lidos
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
          {!isLoading && avisos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum aviso por enquanto. É uma boa notícia.
            </p>
          )}
          {avisos.map((aviso) => (
            <div
              key={aviso.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                aviso.lido && "opacity-60",
                aviso.severidade === "alta" &&
                  "border-l-4 border-l-destructive",
                aviso.severidade === "media" && "border-l-4 border-l-amber-500",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  aviso.severidade === "alta"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{aviso.titulo}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {ehTipoDeAviso(aviso.tipo)
                      ? ROTULO_DO_TIPO[aviso.tipo]
                      : aviso.tipo}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(aviso.quando).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{aviso.corpo}</p>
              </div>
              {!aviso.lido && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto shrink-0"
                  aria-label="Marcar como lido"
                  onClick={() => marcarLido.mutate({ id: aviso.id })}
                >
                  <Check className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <MemoriaDoAstro />
    </div>
  );
}

function MemoriaDoAstro() {
  const { data, isLoading } = useMemorias();
  const esquecer = useEsquecerMemoria();
  const memorias = data?.memorias ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="size-4" />O que o Astro lembra
        </CardTitle>
        <CardDescription>
          Guardado a pedido de alguém desta empresa, nas conversas. Nada daqui
          sai para outra organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
        {!isLoading && memorias.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ele ainda não guardou nada. Peça na conversa: "lembra que a
            reposição é na terça".
          </p>
        )}
        {memorias.map((memoria) => (
          <div
            key={memoria.id}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {memoria.chave}
                </span>
                {memoria.origem === "resumo" && (
                  <Badge variant="outline" className="text-[10px]">
                    fecho de conversa
                  </Badge>
                )}
              </div>
              <p className="text-sm">{memoria.texto}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              aria-label={`Esquecer ${memoria.chave}`}
              onClick={() => esquecer.mutate({ id: memoria.id })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
