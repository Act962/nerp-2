"use client";

import { useState } from "react";
import { PRODUCT_PLACEHOLDER } from "./image-style";

/**
 * A foto do card, com o mockup do sistema como rede de segurança.
 *
 * `cardImageSrc` já cobre o produto SEM foto. O que faltava era o produto com
 * foto que não carrega — arquivo apagado do bucket, chave antiga, caminho que
 * só existe na máquina de quem semeou. Nesses casos o `thumbnail` é verdadeiro,
 * o fallback de ausência não dispara, e o encarte sai com o ícone de imagem
 * quebrada: o pior resultado possível numa peça que vai para o cliente.
 *
 * Guarda QUAL endereço falhou, e não um booleano. É o que faz a falha se
 * desfazer sozinha quando a pessoa troca a foto do produto — com um booleano,
 * um erro deixaria o card no mockup para sempre, e seria preciso um efeito só
 * para zerá-lo.
 */
export function useFotoComFallback(src: string) {
  const [quebrada, setQuebrada] = useState<string | null>(null);

  return {
    src: quebrada === src ? PRODUCT_PLACEHOLDER : src,
    onError: () => setQuebrada(src),
  };
}
