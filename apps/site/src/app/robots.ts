import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * O `robots.txt`.
 *
 * O site é uma vitrine: quase tudo aqui deve ser rastreado, e a lista de
 * bloqueio é curta de propósito. Bloquear demais é o erro mais caro de SEO
 * técnico — e o mais difícil de perceber, porque a página continua no ar.
 *
 * O que fica de fora, e por quê:
 *
 * - **`/api/`** — o proxy do consultor é POST, grava lead e gasta token de
 *   LLM. Não tem conteúdo para indexar e não deve receber visita de robô.
 * - **`/og`** NÃO entra na lista. Ele parece técnico, mas é a imagem dos
 *   cartões de compartilhamento: o rastreador do Facebook e do X respeita
 *   `robots.txt` ao buscar a imagem, e bloqueá-lo esvaziaria a prévia de todo
 *   link do site.
 *
 * Não há `crawlDelay`: o site tem 44 endereços, não é um catálogo de milhões,
 * e atrasar o rastreio só adiaria a indexação.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // O host canônico: com o site respondendo em mais de um endereço (o
    // domínio e o do provedor, por exemplo), é ele que diz qual é o oficial.
    host: SITE_URL,
  };
}
