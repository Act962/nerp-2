import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert className="size-8 text-amber-500" />
          </EmptyMedia>
          <EmptyTitle>Sem acesso a nenhuma página</EmptyTitle>
          <EmptyDescription>
            Peça ao administrador da sua empresa para liberar páginas em
            Configurações → Permissões.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/login">Trocar de conta</Link>
        </Button>
      </Empty>
    </div>
  );
}
