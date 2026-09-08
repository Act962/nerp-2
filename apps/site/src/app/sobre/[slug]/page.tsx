import type { Metadata } from "next";
import {
  metadataDaPaginaInterna,
  renderPaginaInterna,
} from "@/lib/pagina-interna";

/**
 * Uma página institucional — a empresa, as parcerias, os treinamentos.
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
  return metadataDaPaginaInterna("sobre", slug);
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPaginaInterna("sobre", slug);
}
