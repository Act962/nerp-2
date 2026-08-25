"use client";

import { Button } from "@/components/ui/button";
import { useCategoryModal } from "@/hooks/modals/use-category-modal";
import { Plus } from "lucide-react";

export function CreateCategoryButton() {
  const { onOpen } = useCategoryModal();

  return (
    <Button size="sm" onClick={onOpen}>
      <Plus className="h-4 w-4 mr-2" />
      Nova Categoria
    </Button>
  );
}
