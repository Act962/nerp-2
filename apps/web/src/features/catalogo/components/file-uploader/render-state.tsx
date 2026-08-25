import { cn } from "@/lib/utils";
import { Check, ImageIcon, Trash2, UploadIcon, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function RenderEmptyState({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
        <UploadIcon
          className={cn(
            "text-muted-foreground",
            isDragActive && "text-primary"
          )}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Arraste e solte arquivos ou{" "}
        <span className="text-primary font-bold cursor-pointer">
          clique para upload
        </span>
      </p>
    </div>
  );
}

export function RenderErrorState() {
  return (
    <div className="text-destructive text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-destructive/30 mb-4">
        <ImageIcon className="text-destructive" />
      </div>
      <p className="text-sm font-semibold">Falha no upload</p>
      <p className="text-xs mt-1 text-muted-foreground">Algo deu errado</p>
    </div>
  );
}

export function RenderUploadedState({
  previewUrl,
  isDeleting,
  handleDelete,
  fileType,
}: {
  previewUrl: string;
  isDeleting: boolean;
  handleDelete: () => void;
  fileType: "image" | "video";
}) {
  return (
    <div className="group w-full h-full relative">
      <Image
        src={previewUrl}
        alt="Uploaded file"
        fill
        className="object-contain p-2"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? <Spinner /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function RenderUploadingState({
  progress,
  file,
}: {
  progress: number;
  file: File;
}) {
  return (
    <div className="text-center flex justify-center items-center flex-col">
      <Spinner className="mb-2" />
      <p className="text-sm font-medium text-foreground">{progress}%</p>
      <p className="text-xs text-muted-foreground mt-1">Enviando...</p>
    </div>
  );
}

export function RenderPreviewState({
  previewUrl,
  onConfirm,
  onCancel,
  fileType,
}: {
  previewUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
  fileType: "image" | "video";
}) {
  return (
    <div className="w-full h-full relative">
      <Image
        src={previewUrl}
        alt="Preview file"
        fill
        className="object-contain"
      />
      <div className="absolute bottom-2 right-2 flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="gap-2"
        >
          <Check className="size-4" />
          Confirmar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="gap-2"
        >
          <X className="size-4" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
