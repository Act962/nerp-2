import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo";

/**
 * O cartão de compartilhamento, desenhado.
 *
 * Sem `og:image` um link compartilhado vira uma linha de texto no WhatsApp, no
 * LinkedIn e no X — e as 40 páginas internas nascem sem imagem, porque o campo
 * do admin começa vazio. Então o cartão é gerado aqui, com o título da própria
 * página, em 1200×630 (a proporção 1.91:1 que as três redes esperam).
 *
 * Quando o admin sobe uma imagem, ela ganha: `ogImage` em `lib/seo.ts` só cai
 * para cá quando não há nada cadastrado.
 *
 * NÃO fica sob `/api`: o `robots.txt` bloqueia aquele prefixo, e o rastreador
 * do Facebook e do X respeita robots ao buscar a imagem — o cartão apareceria
 * vazio. Aqui ele é liberado, como qualquer outro asset do site.
 */

export const runtime = "nodejs";

/** As cores da marca, as mesmas de `orbita.css`. Nada foi redesenhado. */
const VOID = "#01040c";
const DEEP = "#030b1a";
const BLUE = "#0a93f7";
const BRIGHT = "#3db4ff";
const MIST = "#9db2cd";

/**
 * O texto que chega pela query é DESCONHECIDO.
 *
 * A rota é pública e o endereço é adivinhável: sem limite, ela vira um gerador
 * de imagem com texto arbitrário hospedado no domínio do site. Cortar o
 * comprimento e tirar os caracteres de controle é o que a mantém sendo o que
 * ela é — um cartão para os títulos que já existem no site.
 */
function limpar(valor: string | null, maximo: number): string {
  if (!valor) return "";
  return (
    valor
      // biome-ignore lint/suspicious/noControlCharactersInRegex: tirar caractere de controle do texto da query é exatamente o objetivo
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximo)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, host: hostDoPedido } = new URL(request.url);
  const host = SITE_URL ? new URL(SITE_URL).host : hostDoPedido;
  const titulo =
    limpar(searchParams.get("titulo"), 120) ||
    "Tecnologia que orbita possibilidades";
  const chapeu = limpar(searchParams.get("chapeu"), 40);

  // Título longo em corpo grande estoura a caixa; o degrau é por faixa de
  // tamanho, e não contínuo, para o cartão não mudar de cara a cada palavra.
  const corpo = titulo.length > 78 ? 52 : titulo.length > 46 ? 64 : 76;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: `linear-gradient(135deg, ${VOID} 0%, ${DEEP} 55%, #06203f 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      {/* O arco e a esfera da marca, em CSS: um anel cortado e um ponto sobre
          ele. Não é o arquivo oficial redesenhado — é uma citação geométrica,
          do mesmo jeito que o `BrandSpinner` faz na tela. */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 46,
            border: `5px solid ${BLUE}`,
            borderTopColor: "transparent",
            borderRightColor: "transparent",
            display: "flex",
          }}
        />
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            color: "#fff",
            fontWeight: 700,
            display: "flex",
          }}
        >
          ÓRBITA HUB
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {chapeu && (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: BRIGHT,
            }}
          >
            {chapeu}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: corpo,
            lineHeight: 1.12,
            color: "#fff",
            fontWeight: 700,
            maxWidth: 1000,
          }}
        >
          {titulo}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid rgba(120, 170, 230, 0.22)`,
          paddingTop: 26,
          fontSize: 24,
          color: MIST,
        }}
      >
        {/* O host sai da configuração; sem ela, do próprio pedido.

            Um cartão que afirma um domínio diferente do que serve a página é o
            tipo de detalhe que só aparece depois de já ter sido compartilhado —
            e `SITE_URL` pode não estar definida, caso em que o host de quem
            pediu a imagem é a melhor resposta disponível. */}
        <div style={{ display: "flex" }}>{host}</div>
        <div style={{ display: "flex", color: BRIGHT }}>
          Tecnologia que orbita possibilidades
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        // O cartão é função pura do título: uma vez desenhado, não muda. Cache
        // longo tira o custo de redesenhar a cada raspagem de rede social.
        "cache-control": "public, max-age=3600, s-maxage=86400, immutable",
      },
    },
  );
}
