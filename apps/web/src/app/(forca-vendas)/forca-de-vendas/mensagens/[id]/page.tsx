import { requirePermission } from "@/lib/auth-utils";
import { TelaDeConversa } from "@/features/forca-vendas/components/mensagens";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("forca-vendas");
  const { id } = await params;
  return <TelaDeConversa conversationId={id} />;
}
