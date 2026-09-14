import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Mesa",
  // O endereço é a credencial da mesa, não conteúdo para índice de busca.
  robots: ROBOTS_TELA_DE_APP,
};

/**
 * O adesivo da mesa, aberto pela câmera do CLIENTE.
 *
 * O garçom lê o mesmo QR por dentro do app dele, que resolve o token pela
 * procedure. Esta rota existe porque o adesivo é papel colado na mesa: se o
 * endereço der 404 para quem aponta a câmera do celular, não há conserto —
 * seria preciso reimprimir e recolar tudo.
 *
 * Por ora leva ao cardápio da loja. Levar a mesa junto (pedido já amarrado à
 * mesa, sem digitar) é o passo seguinte, registrado na spec.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;

  const mesa = await prisma.serviceTable.findFirst({
    where: { qrToken, isActive: true },
    select: {
      number: true,
      organization: { select: { subdomain: true, slug: true } },
    },
  });

  if (!mesa?.organization.subdomain) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";
  const protocolo = base.startsWith("localhost") ? "http" : "https";

  redirect(`${protocolo}://${mesa.organization.subdomain}.${base}`);
}
