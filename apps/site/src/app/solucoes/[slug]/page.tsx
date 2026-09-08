import type { Metadata } from "next";
import {
  metadataDaPaginaInterna,
  renderPaginaInterna,
} from "@/lib/pagina-interna";

/**
 * A página interna de uma solução, montada pelo admin em `/site`.
 *
 * Só o publicado chega aqui pelo banco — o `apps/web` responde 404 para
 * rascunho — e o que não está no banco cai na versão que mora no código. A
 * máquina das três seções é a mesma: ver `lib/pagina-interna.tsx`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return metadataDaPaginaInterna("solucoes", slug);
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPaginaInterna("solucoes", slug);
}
