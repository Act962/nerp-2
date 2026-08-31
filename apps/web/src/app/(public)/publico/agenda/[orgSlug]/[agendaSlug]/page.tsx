import type { Metadata } from "next";
import { AgendaPublica } from "@/features/agenda/components/agenda-publica";

export const metadata: Metadata = {
  title: "Agendar horário",
  // Página de marcação é link mandado para um cliente específico, não conteúdo
  // para buscador — indexar exporia a agenda de toda loja na busca.
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; agendaSlug: string }>;
}) {
  const { orgSlug, agendaSlug } = await params;
  return <AgendaPublica orgSlug={orgSlug} agendaSlug={agendaSlug} />;
}
