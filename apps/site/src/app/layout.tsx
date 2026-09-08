import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { NavigationOverlay } from "./_components/navigation-overlay";
import {
  ROBOTS_INDEXAVEL,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  ogImage,
} from "@/lib/seo";
import "./globals.css";

/**
 * O site institucional não herda nada do design system do ERP: cada tela traz
 * o próprio CSS, e este layout só monta o documento.
 *
 * A exceção é a fonte. `orbita.css` pede `var(--font-geist-sans)` como
 * primeira opção da pilha, e é daqui que essa variável vem — sem isto o site
 * cai no `-apple-system` e a tipografia muda de cara.
 *
 * `display: "swap"` é explícito: o padrão do `next/font` já é esse, mas o
 * valor é o que garante que o texto apareça na fonte de sistema enquanto a
 * Geist chega, em vez de ficar invisível. É a diferença entre um LCP de texto
 * cedo e um bloco em branco de até três segundos.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/*
  Título, descrição e cartão em constantes.

  Eles aparecem em três lugares (o `<title>`, o Open Graph e o Twitter Card) e
  precisam dizer a MESMA coisa nos três — quando estavam escritos à mão, a
  descrição do `og:` já tinha ficado uma frase mais curta que a do `<meta>`.
*/
const TITULO = "ÓRBITA HUB — Tecnologia que orbita possibilidades";
// 158 caracteres é o teto prático do que o Google exibe. Esta frase está em
// 151 — medida, não estimada.
const DESCRICAO =
  "Conectamos tecnologia, gestão, dados e inovação para transformar negócios. Uma suíte de 28 ferramentas que dividem o mesmo cadastro, funil e histórico.";
const CARTAO = ogImage({ titulo: "Tecnologia que orbita possibilidades" });

/**
 * O metadata que vale para o site inteiro.
 *
 * Cada página sobrescreve título, descrição, canonical e imagem. O que fica
 * aqui é o que não muda de página para página — e o `metadataBase`, que é o
 * que faz toda URL relativa virar absoluta na hora de resolver canonical e
 * `og:image`. Sem ele o Next resolve contra `localhost` e o canonical de
 * produção sai errado, em silêncio.
 *
 * Não há `alternates.canonical` aqui de propósito: um canonical no layout
 * viraria "/" para toda página que não o sobrescrevesse — inclusive o 404.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  /*
    Sem `template`.

    A tentação é `"%s | ÓRBITA HUB"`, mas os títulos das páginas internas vêm
    do campo de SEO do admin e já terminam em "— ÓRBITA HUB" — o template
    entregaria "CRM Tracking — ÓRBITA HUB | ÓRBITA HUB". Quem garante a marca
    no fim, uma vez só, é `comMarca()` em `lib/seo.ts`.
  */
  title: TITULO,
  description: DESCRICAO,
  applicationName: SITE_NAME,
  robots: ROBOTS_INDEXAVEL,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: `${SITE_URL}/`,
    title: TITULO,
    description: DESCRICAO,
    images: CARTAO,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: CARTAO,
  },
  // O telefone do rodapé já é um `tel:`; sem isto o iOS transforma qualquer
  // sequência de dígitos do texto em link, e números de dado viram telefone.
  formatDetection: { telephone: false, address: false, email: false },
};

/**
 * O viewport.
 *
 * `width=device-width, initial-scale=1` é o padrão do Next e continua valendo;
 * declarar aqui é o que permite acrescentar o `themeColor` sem perdê-lo.
 *
 * Sem `maximumScale` e sem `userScalable: false`: travar o zoom quebra a
 * acessibilidade em celular e é penalizado — a pessoa tem de poder aproximar.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#01040c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        {/* Fica fora de `children` para sobreviver à troca de página: é ele
            que cobre a viagem de uma para a outra. */}
        <NavigationOverlay />
      </body>
    </html>
  );
}
