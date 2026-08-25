import { cn } from "@/lib/utils";
import { Trash2Icon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

export function RenderLogoEmptyState({
  isDragActive,
}: {
  isDragActive: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <UploadIcon className="size-6 text-muted-foreground" />
    </div>
  );
}

export function RenderLogoUploadedState({
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
    <div className="group relative size-full">
      <Image
        src={previewUrl}
        alt="Uploaded file"
        fill
        className="size-full object-cover"
      />
      <Button
        variant="destructive"
        size="icon"
        className={cn(
          "absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100"
        )}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? <Spinner /> : <Trash2Icon className="size-4" />}
      </Button>
    </div>
  );
}

export function RenderLogoUploadingState({
  file,
  progress,
}: {
  progress: number;
  file: File;
}) {
  return (
    <div className="size-full flex flex-col items-center justify-center">
      <span> {progress}% </span>
      <p className="text-sm font-medium text-foreground">
        <Spinner />
      </p>
    </div>
  );
}
