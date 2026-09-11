"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatarEstrelas,
  lerEstrelasDigitadas,
} from "@/features/stars/lib/decimal";
import {
  useDefinirPrecoDaEmpresa,
  usePrecosDaEmpresa,
} from "../hooks/use-site-admin";

/**
 * Quanto cada ação custa, numa empresa.
 *
 * É a tela que **liga a cobrança**: enquanto tudo está em zero, nada é
 * debitado e nada é bloqueado. Por isso o aviso de que ligar tem consequência
 * fica ao lado do campo, e não escondido num tooltip.
 *
 * Ela morava em `/configuracoes/stars`, dentro da organização — ou seja, o
 * cliente definia o próprio preço. Foi assim que uma conta ficou com o Astro a
 * 0 ★ e conversou de graça por dias sem nada aparecer no painel. Preço é
 * decisão comercial da casa, então mudou de lado junto com a guarda.
 */
export function PrecosDaEmpresaDialog({
  empresa,
  onClose,
}: {
  empresa: { id: string; nome: string } | null;
  onClose: () => void;
}) {
  const { precos, isLoading } = usePrecosDaEmpresa(empresa?.id ?? null);
  const salvar = useDefinirPrecoDaEmpresa();

  return (
    <Dialog open={empresa !== null} onOpenChange={(a) => !a && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preço das ações</DialogTitle>
          <DialogDescription>{empresa?.nome}</DialogDescription>
        </DialogHeader>

        {isLoading || !precos ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {precos.cobrancaAtiva ? (
                <>
                  A cobrança está <strong>ligada</strong>. Quando o saldo
                  acabar, a ação para até haver crédito.
                </>
              ) : (
                <>
                  A cobrança está <strong>desligada</strong>: tudo em zero, nada
                  é debitado e nada é bloqueado. Basta pôr um valor para ligar.
                </>
              )}
            </p>

            {precos.regras.map((regra) => (
              <LinhaDePreco
                key={regra.actionKey}
                regra={regra}
                salvando={salvar.isPending}
                onSalvar={(stars) =>
                  empresa &&
                  salvar.mutate({
                    organizationId: empresa.id,
                    actionKey: regra.actionKey,
                    stars,
                  })
                }
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinhaDePreco({
  regra,
  salvando,
  onSalvar,
}: {
  regra: { actionKey: string; label: string; descricao: string; stars: number };
  salvando: boolean;
  onSalvar: (stars: number) => void;
}) {
  const [valor, setValor] = useState(formatarEstrelas(regra.stars));

  // Depois de salvar, o refetch traz o valor gravado — o campo acompanha em
  // vez de continuar mostrando o que foi digitado.
  useEffect(() => setValor(formatarEstrelas(regra.stars)), [regra.stars]);

  // Vírgula, porque em pt-BR ninguém digita "0.2". `null` é o que não é
  // número: o botão trava em vez de gravar zero, que DESLIGARIA a cobrança.
  const numero = lerEstrelasDigitadas(valor);
  const valido = numero !== null && numero <= 1000;
  const mudou = numero !== null && numero !== regra.stars;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{regra.label}</p>
        <p className="text-muted-foreground text-xs">{regra.descricao}</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="decimal"
          aria-label={`Preço de ${regra.label} em Stars`}
          aria-invalid={valor.trim() !== "" && !valido}
          className="w-24"
          placeholder="0"
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
        />
        <span className="text-muted-foreground text-sm">★</span>
        <Button
          size="sm"
          variant={mudou ? "default" : "outline"}
          disabled={!valido || !mudou || salvando}
          onClick={() => numero !== null && onSalvar(numero)}
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
