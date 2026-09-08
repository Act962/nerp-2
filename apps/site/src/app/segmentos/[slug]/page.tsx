import type { Metadata } from "next";
import {
  metadataDaPaginaInterna,
  renderPaginaInterna,
} from "@/lib/pagina-interna";

/**
 * A página de um segmento: o que a suíte faz naquela operação.
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
  return metadataDaPaginaInterna("segmentos", slug);
}

export default async function SegmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPaginaInterna("segmentos", slug);
}
