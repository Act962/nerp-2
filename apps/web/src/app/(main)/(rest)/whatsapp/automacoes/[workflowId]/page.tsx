import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AutomacaoEditor } from "@/features/automacoes/components/automacao-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  await requirePermission("whatsapp");
  const { workflowId } = await params;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Link
        href="/whatsapp/automacoes"
        className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Automações
      </Link>
      <AutomacaoEditor workflowId={workflowId} />
    </div>
  );
}
