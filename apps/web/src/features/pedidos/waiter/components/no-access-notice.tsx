import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";

interface Props {
  orgName: string;
  reason: "no-membership" | "not-found";
}

export function NoAccessNotice({ orgName, reason }: Props) {
  const isNotFound = reason === "not-found";
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isNotFound ? (
              <TriangleAlert className="size-8 text-amber-500" />
            ) : (
              <ShieldAlert className="size-8 text-amber-500" />
            )}
          </EmptyMedia>
          <EmptyTitle>
            {isNotFound ? "Estabelecimento não encontrado" : "Sem acesso ao app"}
          </EmptyTitle>
          <EmptyDescription>
            {isNotFound
              ? `Não localizamos "${orgName}". Confira o QR code com o atendente.`
              : `Você está logado, mas ainda não foi convidado para "${orgName}". Peça ao gerente para adicionar você como membro.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/login">Trocar de conta</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
