"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * A faixa de preço avulso por ferramenta, para o comparativo da tela de planos.
 *
 * Existe como hook, e não como `useQuery` solto no componente, porque é a
 * convenção do repositório: toda chamada a `orpc` mora num hook da feature. E
 * é o que permite o teste de componente dublar a fonte sem arrastar o cliente
 * oRPC — e o servidor inteiro atrás dele — para dentro do jsdom.
 *
 * Cinco minutos de `staleTime`: é uma tabela comercial que muda em semanas, e
 * a tela de planos é visitada várias vezes na mesma sessão de dúvida.
 */
export function usePrecosAvulsos() {
  return useQuery(
    orpc.billing.precosAvulsos.queryOptions({ input: {}, staleTime: 300_000 }),
  );
}
