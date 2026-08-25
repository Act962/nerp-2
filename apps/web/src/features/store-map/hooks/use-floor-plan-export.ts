"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// Gera o PDF vetorial da planta no servidor e abre a URL do R2 numa nova aba.
export function useExportFloorPlanPdf() {
  return useMutation(
    orpc.floorPlan.exportPdf.mutationOptions({
      onSuccess: (result) => {
        window.open(constructUrl(result.key), "_blank", "noopener");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
