"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  useAddBookExtraPage,
  useIndustryTemplates,
} from "../../hooks/use-books";

// Botão do editor de book para inserir uma PÁGINA EXTRA (abertura, divisória,
// encerramento) a partir dos padrões kind=EXTRA da indústria. A página entra
// no fim e é reposicionada com as setas ↑/↓ das páginas.
export function AddExtraPageButton({
  bookId,
  supplierId,
}: {
  bookId: string;
  supplierId: string | null;
}) {
  const { data } = useIndustryTemplates(supplierId ?? "");
  const add = useAddBookExtraPage();

  // Book sem indústria não tem padrões de página extra pra oferecer.
  if (!supplierId) return null;

  const extras = data?.extras ?? [];

  if (extras.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma página extra cadastrada.{" "}
        <Link
          href={`/padroes/industria/${supplierId}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Criar em Padrões
        </Link>
      </p>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={add.isPending}>
          <Plus className="size-4" />
          Adicionar página extra
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {extras.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => add.mutate({ bookId, templateId: t.id })}
          >
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
