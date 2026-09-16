"use client";

import { CheckCircle2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { casaRota } from "../lib/rota";
import { useJornadaStore } from "../hooks/use-jornada-store";
import { useIniciarJornada, useJornadas } from "../hooks/use-jornadas";

/**
 * Todas as jornadas que a pessoa pode fazer, com o progresso de cada uma.
 *
 * É a saída para quem quer aprender uma tela que não está aberta agora: começa
 * aqui, o sistema navega, e o motor retoma o balão quando a tela chega.
 */
export function ListaDeJornadas({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { data, isPending } = useJornadas();
  const router = useRouter();
  const pathname = usePathname();
  const iniciar = useIniciarJornada();
  const comecar = useJornadaStore((estado) => estado.comecar);

  const comecarJornada = async (jornadaId: string, rota: string) => {
    if (!data) return;
    const resposta = await iniciar.mutateAsync({ jornadaId });
    comecar({
      jornadaId,
      organizationId: data.organizationId,
      iniciadaEm: resposta.iniciadaEm,
    });
    aoFechar();
    // Só navega se precisar: um `push` para a tela em que já se está recarrega
    // o alvo debaixo do balão sem motivo.
    if (!casaRota(rota, pathname)) router.push(rota);
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jornadas guiadas</DialogTitle>
          <DialogDescription>
            Eu te ensino cada tela passo a passo, e você ganha ★ para a empresa
            ao concluir.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] space-y-2 overflow-y-auto px-1">
          {isPending && (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          )}

          {data?.jornadas.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhuma jornada disponível para as suas permissões.
            </p>
          )}

          {data?.jornadas
            .filter((jornada) => jornada.ativa)
            .map((jornada) => {
              const concluida = Boolean(jornada.meuProgresso?.concluidaEm);
              const passo = jornada.meuProgresso?.passoAtual ?? 0;
              const comecou = passo > 0 && !concluida;
              const pct = Math.round((passo / jornada.totalPassos) * 100);

              return (
                <div key={jornada.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        {concluida && (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        )}
                        {jornada.titulo}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {jornada.totalPassos} passos · ~{jornada.minutos} min
                        {jornada.stars > 0 && (
                          <>
                            {" · "}
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="size-3 text-amber-500" />
                              {jornada.stars}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={concluida ? "outline" : "default"}
                      disabled={iniciar.isPending}
                      onClick={() => comecarJornada(jornada.id, jornada.rota)}
                    >
                      {concluida
                        ? "Refazer"
                        : comecou
                          ? "Continuar"
                          : "Começar"}
                    </Button>
                  </div>

                  {comecou && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
