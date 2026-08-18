import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function EmptyCatalog() {
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
        <Button>Criar catálogo</Button>
      </EmptyContent>
    </Empty>
  );
}
