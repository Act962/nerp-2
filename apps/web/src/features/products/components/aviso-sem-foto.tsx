import { ImageOffIcon } from "lucide-react";

/**
 * A vitrine pública só mostra produto com foto. O aviso aparece só enquanto
 * falta a foto — produto com imagem não precisa de lembrete nenhum.
 */
export function AvisoSemFoto({ temFoto }: { temFoto: boolean }) {
  if (temFoto) return null;
  return (
    <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
      <ImageOffIcon className="size-3.5 shrink-0" />
      Sem foto, o produto não aparece no catálogo.
    </p>
  );
}
