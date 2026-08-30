"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc";

/**
 * Preço de cada ação, em ★.
 *
 * É a tela que **liga a cobrança**: enquanto tudo está em zero, nada é
 * debitado e nada é bloqueado. Por isso o aviso de que ligar tem consequência
 * fica ao lado do campo, e não escondido num tooltip — quem digita "2" aqui
 * está decidindo que a loja para de enviar mensagem quando o saldo acabar.
 */
export function PrecosDasAcoes() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(
    orpc.stars.rules.list.queryOptions({ input: {} }),
  );

  const salvar = useMutation(
    orpc.stars.rules.set.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          resultado.stars === 0
            ? "Cobrança desta ação desligada"
            : `Passou a custar ${resultado.stars} ★`,
        );
        queryClient.invalidateQueries({ queryKey: orpc.stars.key() });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (isPending || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando preços…
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-medium text-sm">Preço das ações</h2>
        <p className="text-muted-foreground text-sm">
          {data.cobrancaAtiva ? (
            <>
              A cobrança está <strong>ligada</strong>. Quando o saldo acabar, o
              envio para até haver crédito.
            </>
          ) : (
            <>
              A cobrança está <strong>desligada</strong>: tudo em zero, nada é
              debitado e nada é bloqueado. Basta pôr um valor para ligar.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {data.regras.map((regra) => (
          <LinhaDePreco
            key={regra.actionKey}
            regra={regra}
            podeEditar={data.podeEditar}
            salvando={salvar.isPending}
            onSalvar={(stars) =>
              salvar.mutate({ actionKey: regra.actionKey, stars })
            }
          />
        ))}
      </div>

      {!data.podeEditar ? (
        <p className="text-muted-foreground text-xs">
          Só administradores mudam o preço das ações.
        </p>
      ) : null}
    </section>
  );
}

function LinhaDePreco({
  regra,
  podeEditar,
  salvando,
  onSalvar,
}: {
  regra: { actionKey: string; label: string; descricao: string; stars: number };
  podeEditar: boolean;
  salvando: boolean;
  onSalvar: (stars: number) => void;
}) {
  const [valor, setValor] = useState(String(regra.stars));

  // Depois de salvar, o refetch traz o valor gravado — o campo acompanha em
  // vez de continuar mostrando o que foi digitado.
  useEffect(() => setValor(String(regra.stars)), [regra.stars]);

  const numero = Number(valor);
  const valido = Number.isInteger(numero) && numero >= 0 && numero <= 1000;
  const mudou = numero !== regra.stars;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{regra.label}</p>
        <p className="text-muted-foreground text-xs">{regra.descricao}</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={1000}
          inputMode="numeric"
          className="w-24"
          disabled={!podeEditar}
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
        />
        <span className="text-muted-foreground text-sm">★</span>
        {podeEditar ? (
          <Button
            size="sm"
            variant={mudou ? "default" : "outline"}
            disabled={!valido || !mudou || salvando}
            onClick={() => onSalvar(numero)}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
