import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgendaEditor } from "@/features/agenda/components/agenda-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ agendaId: string }>;
}) {
  await requirePermission("whatsapp");
  const { agendaId } = await params;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Link
        href="/whatsapp/agenda"
        className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Agendas
      </Link>
      <AgendaEditor agendaId={agendaId} />
    </div>
  );
}
