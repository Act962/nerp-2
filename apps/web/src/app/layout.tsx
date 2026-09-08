import "@/lib/orpc.server";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * O metadata da raiz do `apps/web`.
 *
 * **`noindex` é o PADRÃO, e é a decisão importante deste arquivo.**
 *
 * Este app tem 131 páginas e quase todas são tela de sistema: o ERP inteiro,
 * o admin do site, o PDV, o app do promotor, as telas de autorização. Nada
 * disso é conteúdo — são portas que respondem redirecionando para o login, e
 * cada uma indexada é uma página vazia no resultado de busca com o nome da
 * casa em cima.
 *
 * A alternativa seria uma lista de caminhos bloqueados no `robots.txt`, e ela
 * envelhece mal: a rota criada na semana que vem não está na lista, e ninguém
 * percebe. Aqui é o contrário — o padrão protege, e quem é público diz que é.
 * Hoje dizem: a vitrine (`(storefront)/[subdomain]/layout.tsx`) e as páginas
 * públicas do TradeGram.
 *
 * O metadata do Next sobrescreve `robots` por completo no segmento mais
 * profundo, então basta a página ou o layout declarar o dele.
 */
export const metadata: Metadata = {
  title: "NERP — ERP para varejo e trade marketing",
  description:
    "Gestão de estoque, vendas, PDV e trade marketing em um sistema só.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `pt-BR`: o app inteiro é em português. Com `lang="en"` o navegador
    // oferece traduzir a página, o corretor ortográfico dos campos usa o
    // dicionário errado e o leitor de tela lê tudo com fonemas de inglês.
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster richColors />
        </Providers>
      </body>
    </html>
  );
}
