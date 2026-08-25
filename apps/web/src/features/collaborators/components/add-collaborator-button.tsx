"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CollaboratorForm } from "./collaborator-form";

export function AddCollaboratorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Novo colaborador
      </Button>
      <CollaboratorForm open={open} onOpenChange={setOpen} />
    </>
  );
}
