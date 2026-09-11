"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatarEstrelas,
  lerEstrelasDigitadas,
} from "@/features/stars/lib/decimal";
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
            : `Passou a custar ${formatarEstrelas(resultado.stars)} ★`,
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
            onClick={() => numero !== null && onSalvar(numero)}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
