"use client";

import { Button } from "@/components/ui/button";
import { CameraIcon } from "lucide-react";
import { useState } from "react";
import { PdvPhotoDialog } from "./pdv-photo-dialog";
import { PdvPhotoHistory } from "./pdv-photo-history";

interface PdvPhotoSectionProps {
  storeId: string;
  mapObjectId?: string;
  defaultSupplierId?: string | null;
  defaultSection?: string | null;
  title?: string;
}

export function PdvPhotoSection({
  storeId,
  mapObjectId,
  defaultSupplierId,
  defaultSection,
  title = "Fotos do PDV",
}: PdvPhotoSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <CameraIcon className="size-4" />
          Nova foto
        </Button>
      </div>

      <PdvPhotoHistory
        filters={{ storeId, mapObjectId }}
        emptyText="Nenhuma foto registrada ainda."
      />

      <PdvPhotoDialog
        open={open}
        onOpenChange={setOpen}
        storeId={storeId}
        mapObjectId={mapObjectId}
        defaultSupplierId={defaultSupplierId}
        defaultSection={defaultSection}
      />
    </div>
  );
}
