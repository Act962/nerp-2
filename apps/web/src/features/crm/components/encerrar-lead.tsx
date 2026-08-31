"use client";

import { Loader2, RotateCcw, ThumbsDown, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCriarMotivo,
  useEncerrarLead,
  useMotivos,
} from "../hooks/use-etiquetas";

/**
 * Ganho, perda e reabertura.
 *
 * O motivo é o que transforma "perdemos 30 este mês" em "perdemos 30, sendo 18
 * por preço", então ele é pedido no momento do clique — depois ninguém volta
 * para preencher.
 */
export function EncerrarLead({
  leadId,
  funnelId,
  situacao,
}: {
  leadId: string;
  funnelId: string;
  situacao: "ACTIVE" | "WON" | "LOST" | "DELETED";
}) {
  const [escolha, setEscolha] = useState<"WON" | "LOST" | null>(null);
  const encerrar = useEncerrarLead();

  if (situacao === "WON" || situacao === "LOST") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
        <span className="flex items-center gap-2 text-sm">
          {situacao === "WON" ? (
            <Trophy className="size-4 text-emerald-600" />
          ) : (
            <ThumbsDown className="size-4 text-muted-foreground" />
          )}
          {situacao === "WON" ? "Ganho" : "Perdido"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={encerrar.isPending}
          onClick={() => encerrar.mutate({ leadId, resultado: "REABRIR" })}
        >
          <RotateCcw className="size-4" />
          Reabrir
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => setEscolha("WON")}
        >
          <Trophy className="size-4" />
          Ganho
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => setEscolha("LOST")}
        >
          <ThumbsDown className="size-4" />
          Perdido
        </Button>
      </div>

      <DialogDoMotivo
        leadId={leadId}
        funnelId={funnelId}
        resultado={escolha}
        onFechar={() => setEscolha(null)}
      />
    </>
  );
}

function DialogDoMotivo({
  leadId,
  funnelId,
  resultado,
  onFechar,
}: {
  leadId: string;
  funnelId: string;
  resultado: "WON" | "LOST" | null;
  onFechar: () => void;
}) {
  const [reasonId, setReasonId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");

  const aberto = resultado !== null;
  const tipo = resultado === "WON" ? "WIN" : "LOSS";

  const { data } = useMotivos(funnelId, aberto);
  const criarMotivo = useCriarMotivo();
  const encerrar = useEncerrarLead();

  const motivos = (data?.motivos ?? []).filter(
    (motivo) => motivo.tipo === tipo,
  );

  function fechar() {
    setReasonId("");
    setObservacao("");
    setNovoMotivo("");
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {resultado === "WON" ? "Marcar como ganho" : "Marcar como perdido"}
          </DialogTitle>
          <DialogDescription>
            O motivo é opcional, mas é o que faz o relatório do funil dizer
            alguma coisa.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Motivo</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {motivos.map((motivo) => (
                <Button
                  key={motivo.id}
                  type="button"
                  size="sm"
                  variant={reasonId === motivo.id ? "default" : "outline"}
                  onClick={() =>
                    setReasonId(reasonId === motivo.id ? "" : motivo.id)
                  }
                >
                  {motivo.nome}
                </Button>
              ))}
              {motivos.length === 0 && (
                <span className="text-muted-foreground text-sm">
                  Nenhum motivo cadastrado ainda.
                </span>
              )}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="novo-motivo">Ou crie um novo</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="novo-motivo"
                placeholder={
                  resultado === "WON" ? "Melhor prazo…" : "Preço, sem estoque…"
                }
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!novoMotivo.trim() || criarMotivo.isPending}
                onClick={() =>
                  criarMotivo.mutate(
                    { funnelId, nome: novoMotivo.trim(), tipo },
                    {
                      onSuccess: (criado) => {
                        setReasonId(criado.id);
                        setNovoMotivo("");
                      },
                    },
                  )
                }
              >
                Adicionar
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="obs-encerramento">Observação</FieldLabel>
            <Textarea
              id="obs-encerramento"
              rows={2}
              maxLength={500}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            className={cn(resultado === "LOST" && "bg-muted-foreground")}
            disabled={encerrar.isPending}
            onClick={() =>
              resultado &&
              encerrar.mutate(
                {
                  leadId,
                  resultado,
                  reasonId: reasonId || undefined,
                  observacao: observacao.trim() || undefined,
                },
                { onSuccess: fechar },
              )
            }
          >
            {encerrar.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
