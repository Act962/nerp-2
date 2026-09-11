"use client";

import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BASE_PADRAO,
  converterTokensEmEstrelas,
} from "@/features/stars/lib/conversor-de-tokens";
import { arredondarEstrelas } from "@/features/stars/lib/decimal";

/** O que a pessoa digitou, como número. Aceita vírgula; lixo vira zero. */
function numero(texto: string): number {
  const lido = Number(texto.trim().replace(",", "."));
  return Number.isFinite(lido) && lido >= 0 ? lido : 0;
}

/**
 * A calculadora que dá base para o preço do Astro.
 *
 * Ela não grava nada, e é de propósito: preço de API e cotação mudam, e um
 * número que se atualizasse sozinho por trás da cobrança seria pior que um
 * número velho. O resultado é para a pessoa LER, conferir e digitar no campo
 * de preço ao lado — o botão copia para a área de transferência.
 *
 * Os valores de partida são chute e estão marcados como tal na tela. Quem usa
 * confere o preço em ai.google.dev/pricing e a cotação do dia.
 */
export function ConversorDeTokens() {
  const [entrada, setEntrada] = useState(
    String(BASE_PADRAO.preco.entradaPorMilhao),
  );
  const [saida, setSaida] = useState(String(BASE_PADRAO.preco.saidaPorMilhao));
  const [dolar, setDolar] = useState(String(BASE_PADRAO.dolar));
  const [realPorEstrela, setRealPorEstrela] = useState(
    String(BASE_PADRAO.realPorEstrela),
  );
  const [margem, setMargem] = useState(String(BASE_PADRAO.margem));
  const [proporcao, setProporcao] = useState(
    String(Math.round(BASE_PADRAO.proporcaoDeSaida * 100)),
  );

  const resultado = useMemo(
    () =>
      converterTokensEmEstrelas({
        preco: {
          entradaPorMilhao: numero(entrada),
          saidaPorMilhao: numero(saida),
        },
        dolar: numero(dolar),
        realPorEstrela: numero(realPorEstrela),
        margem: numero(margem),
        proporcaoDeSaida: numero(proporcao) / 100,
      }),
    [entrada, saida, dolar, realPorEstrela, margem, proporcao],
  );

  const sugerido = arredondarEstrelas(resultado.estrelasPorMil);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4" />
          Quanto cobrar pelos tokens do Astro
        </CardTitle>
        <CardDescription>
          A conta vai do preço da API até ★ por mil tokens. Nada aqui é salvo:
          confira o número e digite no campo do Astro, acima.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo
            id="tk-entrada"
            rotulo="US$ / milhão (entrada)"
            valor={entrada}
            aoMudar={setEntrada}
          />
          <Campo
            id="tk-saida"
            rotulo="US$ / milhão (saída)"
            valor={saida}
            aoMudar={setSaida}
          />
          <Campo
            id="tk-dolar"
            rotulo="R$ por US$"
            valor={dolar}
            aoMudar={setDolar}
          />
          <Campo
            id="tk-estrela"
            rotulo="R$ por ★"
            valor={realPorEstrela}
            aoMudar={setRealPorEstrela}
          />
          <Campo
            id="tk-margem"
            rotulo="Margem (×)"
            valor={margem}
            aoMudar={setMargem}
          />
          <Campo
            id="tk-proporcao"
            rotulo="% de saída"
            valor={proporcao}
            aoMudar={setProporcao}
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              Sugestão para o preço do Astro
            </span>
            <strong className="text-lg tabular-nums">
              {sugerido.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ★ / mil tokens
            </strong>
          </div>

          <dl className="mt-3 grid gap-1 text-sm">
            <Linha
              termo="Por cem tokens"
              valor={`${resultado.estrelasPorCem.toFixed(3)} ★`}
            />
            <Linha
              termo="Custo real de mil tokens"
              valor={`US$ ${resultado.custoDolarPorMil.toFixed(5)} · R$ ${resultado.custoRealPorMil.toFixed(4)}`}
            />
            <Linha
              termo="Uma ★ compra"
              valor={`${resultado.tokensPorEstrela.toLocaleString("pt-BR")} tokens`}
            />
          </dl>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(String(sugerido).replace(".", ","))
                .catch(() => {});
            }}
          >
            Copiar {String(sugerido).replace(".", ",")}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Os valores de partida são um chute de referência. Confira o preço
          atual em ai.google.dev/pricing e a cotação do dia antes de decidir —
          preço de API muda sem avisar.
        </p>
      </CardContent>
    </Card>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-xs" htmlFor={id}>
        {rotulo}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </div>
  );
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
