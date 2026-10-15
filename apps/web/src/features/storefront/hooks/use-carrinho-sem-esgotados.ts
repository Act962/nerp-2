"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryProductsOfCart } from "@/features/products/hooks/use-products";
import { useCart } from "@/hooks/use-cart";

/**
 * O carrinho mora no navegador e pode guardar um produto que esgotou depois de
 * entrar nele (o estoque vem do ERP a cada sincronização). Sem isto, o cliente
 * só descobria na hora de enviar o pedido. Aqui o item esgotado ou removido da
 * loja sai do pedido assim que a vitrine abre, com aviso de qual foi.
 */
export function useCarrinhoSemEsgotados(subdomain: string) {
  const { products, removeProduct } = useCart(subdomain);
  const idsNoCarrinho = products.map((product) => product.productId);
  const chaveDoCarrinho = idsNoCarrinho.join("|");
  const { data, isSuccess } = useQueryProductsOfCart({
    subdomain,
    productIds: idsNoCarrinho,
  });
  const avisados = useRef(new Set<string>());

  useEffect(() => {
    if (!isSuccess || !chaveDoCarrinho) return;
    const porId = new Map(data.map((product) => [product.id, product]));
    const saindo = chaveDoCarrinho
      .split("|")
      .filter((id) => !porId.get(id)?.disponivel);
    if (saindo.length === 0) return;

    const nomes: string[] = [];
    for (const id of saindo) {
      removeProduct(id);
      const nome = porId.get(id)?.name;
      if (nome && !avisados.current.has(id)) nomes.push(nome);
      avisados.current.add(id);
    }
    if (nomes.length > 0) {
      toast.info(
        nomes.length === 1
          ? `${nomes[0]} esgotou e saiu do seu pedido.`
          : `${nomes.length} produtos esgotaram e saíram do seu pedido: ${nomes.join(", ")}.`,
      );
    }
  }, [isSuccess, data, chaveDoCarrinho, removeProduct]);
}
