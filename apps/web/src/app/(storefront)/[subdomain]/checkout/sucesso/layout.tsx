import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";

/**
 * Existe só para carregar o `metadata` da tela de confirmação.
 *
 * A página é um Client Component (`useRouter`, `useSearchParams`) e componente
 * de cliente não exporta `metadata` — o Next só lê metadata do lado servidor.
 * Um layout mínimo é o caminho padrão para isso: ele roda no servidor,
 * declara o `robots` e devolve os filhos sem embrulhar nada.
 *
 * Confirmação de um pedido específico: não existe fora daquela compra, e o
 * rastreador nunca a alcança com um pedido válido. `follow` continua ligado —
 * os links dela para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: ROBOTS_TELA_DE_APP,
};

export default function CheckoutSucessoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
