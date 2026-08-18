import { Building } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { buttonVariants } from "./ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function EmptyOrganization() {
  return (
    <div className="relative flex items-center justify-center h-full">
      <Image
        src="/setas-para-a-esquerda.png"
        alt="setas-para-a-esquerda"
        width={40}
        height={40}
        className="absolute object-cover size-16 top-4 left-10 dark:invert "
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building />
          </EmptyMedia>
          <EmptyTitle>Nenhuma organização encontrada</EmptyTitle>
          <EmptyDescription>
            Crie uma organização ou selecione alguma para começar a usar o ERP
            Limas.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link
            className={cn(
              buttonVariants({
                variant: "default",
              })
            )}
            href="/create-organization"
          >
            Criar organização
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}
