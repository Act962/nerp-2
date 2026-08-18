"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import { AutoGenerateWizard } from "./auto-generate-wizard";
import { CreateBookDialog } from "./create-book-dialog";

export function AddBookButton() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openAuto, setOpenAuto] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setOpenAuto(true)}>
        <WandSparklesIcon className="size-4" />
        Gerar automático
      </Button>
      <Button onClick={() => setOpenCreate(true)}>
        <PlusIcon className="size-4" />
        Novo book
      </Button>
      <CreateBookDialog open={openCreate} onOpenChange={setOpenCreate} />
      <AutoGenerateWizard open={openAuto} onOpenChange={setOpenAuto} />
    </div>
  );
}
