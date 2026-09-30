"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useCriarCatalogo } from "@/features/storefront/hooks/use-catalog-settings";

/**
 * `erro`: o catálogo existe (ou pode existir), mas não foi possível lê-lo.
 * Oferecer "Criar" nesse caso seria mentir — o clique não mudaria nada.
 */
export function EmptyCatalog({ erro = false }: { erro?: boolean }) {
  const criar = useCriarCatalogo();

  if (erro) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Não foi possível carregar o catálogo</EmptyTitle>
          <EmptyDescription>
            Tente recarregar a página. Se continuar, fale com o suporte.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nenhum catálogo encontrado</EmptyTitle>
        <EmptyDescription>
          Você ainda não criou nenhum catálogo. Comece criando seu primeiro
          catálogo.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button disabled={criar.isPending} onClick={() => criar.mutate({})}>
          Criar catálogo
          {criar.isPending && <Spinner />}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
