import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { NavigationOverlay } from "./_components/navigation-overlay";
import "./globals.css";

/**
 * O site institucional não herda nada do design system do ERP: cada tela traz
 * o próprio CSS, e este layout só monta o documento.
 *
 * A exceção é a fonte. `orbita.css` pede `var(--font-geist-sans)` como
 * primeira opção da pilha, e é daqui que essa variável vem — sem isto o site
 * cai no `-apple-system` e a tipografia muda de cara.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ÓRBITA HUB — Tecnologia que orbita possibilidades",
  description:
    "Conectamos tecnologia, gestão, dados e inovação para transformar negócios.",
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
