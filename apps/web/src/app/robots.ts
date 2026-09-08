import type { MetadataRoute } from "next";

/**
 * O `robots.txt` do `apps/web`.
 *
 * Ele é curto de propósito, e isso é contraintuitivo: este app tem 131 páginas
 * e quase nenhuma deveria aparecer na busca. A tentação é listar todos os
 * caminhos em `Disallow`. Não é o que se faz, por dois motivos.
 *
 * **`Disallow` não é `noindex`.** Ele impede o rastreio, não a indexação: uma
 * página bloqueada aqui, se alguém apontar um link para ela, entra no índice
 * assim mesmo — só que sem título e sem descrição, porque o Google não pôde
 * abrir. Pior ainda: bloqueada, ele nunca LÊ a meta `noindex` da página, e o
 * bloqueio passa a impedir a própria remoção. Quem tira do índice é o
 * `noindex`, que é o padrão da raiz do app (ver `src/app/layout.tsx`).
 *
 * **Este arquivo vale para todos os hostnames.** O middleware reescreve
 * `loja.dominio.com` para dentro da mesma árvore, então este `robots.txt` é
 * servido igual para o domínio do ERP e para o de cada loja. Um `Disallow: /`
 * aqui apagaria todas as vitrines dos clientes da busca de uma vez.
 *
 * Sobra o que não tem conteúdo para ler nem meta tag para declarar: as rotas
 * de API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Sem HTML e sem meta tag: não há nada a indexar e nada a declarar.
        // `/api/site/` é a exceção que fica de fora da regra por ser lida pelo
        // `apps/site`, mas robô nenhum precisa dela — o prefixo cobre tudo.
        disallow: ["/api/"],
      },
    ],
  };
}
