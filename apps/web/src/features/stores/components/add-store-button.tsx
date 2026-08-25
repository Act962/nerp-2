"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { StoreFormDialog } from "./store-form-dialog";

export function AddStoreButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Nova loja
      </Button>
      <StoreFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
