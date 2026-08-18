"use client";

import { useCallback, useEffect, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  RenderEmptyState,
  RenderErrorState,
  RenderUploadedState,
  RenderUploadingState,
  RenderPreviewState,
} from "./render-state";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface UploaderState {
  id: string | null;
  file: File | null;
  uploading: boolean;
  progress: number;
  key?: string;
  isDeleting: boolean;
  error: boolean;
  objectUrl?: string;
  fileType: "image" | "video";
}

const MAX_SIZE = 1024 * 1024 * 5;

interface CarouselUploaderProps {
  value?: string;
  onChange?: (value: string) => void;
  onConfirm?: (value: string) => void;
  fileTypeAccepted?: "image" | "video";
}

export function CarouselUploader({
  value,
  onChange,
  onConfirm,
  fileTypeAccepted = "image",
}: CarouselUploaderProps) {
  const fileUrl = useConstructUrl(value || "");
  const [fileState, setFileState] = useState<UploaderState>({
    error: false,
    file: null,
    id: null,
    uploading: false,
    progress: 0,
    isDeleting: false,
    fileType: fileTypeAccepted,
    key: value,
    objectUrl: value ? fileUrl : undefined,
  });

  const [showPreview, setShowPreview] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setFileState((prev) => ({
        ...prev,
        uploading: true,
        progress: 0,
      }));

      try {
        // 1. Get presigned URL
        const presignedResponse = await fetch("/api/s3/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
            isImage: fileTypeAccepted === "image" ? true : false,
          }),
        });

        if (!presignedResponse.ok) {
          toast.error("Falha ao gerar URL presignada");
          setFileState((prev) => ({
            ...prev,
            uploading: false,
            progress: 0,
            error: true,
          }));
          return;
        }

        const { presignedUrl, key } = await presignedResponse.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentageCompleted = (event.loaded / event.total) * 100;
              setFileState((prev) => ({
                ...prev,
                progress: Math.round(percentageCompleted),
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 204) {
              setFileState((prev) => ({
                ...prev,
                progress: 100,
                uploading: false,
                key: key,
              }));

              onChange?.(key);
              setShowPreview(true);
              toast.success("Arquivo enviado com sucesso");
              resolve();
            } else {
              reject(new Error("Upload failed..."));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Upload failed..."));
          };

          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
      } catch {
        toast.error("Falha ao enviar arquivo");
        setFileState((prev) => ({
          ...prev,
          progress: 0,
          error: true,
          uploading: false,
        }));
      }
    },
    [fileTypeAccepted, onChange]
  );

  async function removeFile() {
    if (fileState.isDeleting || !fileState.objectUrl) return;

    try {
      setFileState((prev) => ({
        ...prev,
        isDeleting: true,
      }));

      const response = await fetch("/api/s3/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: fileState.key,
        }),
      });

      if (!response.ok) {
        toast.error("Falha ao deletar arquivo");
        setFileState((prev) => ({
          ...prev,
          isDeleting: false,
          error: true,
        }));
        return;
      }

      if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
        URL.revokeObjectURL(fileState.objectUrl);
      }

      onChange?.("");
      resetUploader();
      toast.success("Arquivo deletado com sucesso");
    } catch {
      toast.error("Falha ao deletar arquivo. Por favor, tente novamente.");
      setFileState((prev) => ({
        ...prev,
        isDeleting: false,
        error: true,
      }));
    }
  }

  function resetUploader() {
    if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
      URL.revokeObjectURL(fileState.objectUrl);
    }

    setFileState({
      file: null,
      uploading: false,
      progress: 0,
      objectUrl: undefined,
      error: false,
      fileType: fileTypeAccepted,
      id: null,
      isDeleting: false,
    });

    setShowPreview(false);
    onChange?.("");
  }

  function handleConfirm() {
    if (!fileState.key) return;

    onConfirm?.(fileState.key);
    resetUploader();
    toast.success("Imagem adicionada ao carrossel");
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
          URL.revokeObjectURL(fileState.objectUrl);
        }

        setFileState({
          file: file,
          uploading: false,
          progress: 0,
          objectUrl: URL.createObjectURL(file),
          error: false,
          id: uuidv4(),
          isDeleting: false,
          fileType: fileTypeAccepted,
        });

        uploadFile(file);
      }
    },
    [fileState.objectUrl, uploadFile, fileTypeAccepted]
  );

  function rejectedFiles(fileRejection: FileRejection[]) {
    if (fileRejection.length) {
      const tooManyFiles = fileRejection.find(
        (rejection) => rejection.errors[0].code === "too-many-files"
      );

      const fileSizeToBig = fileRejection.find(
        (rejection) => rejection.errors[0].code === "file-too-large"
      );

      if (fileSizeToBig) {
        toast.error("Arquivo muito grande, máximo de 5MB.");
      }

      if (tooManyFiles) {
        toast.error("Muitos arquivos selecionados, máximo de 1 arquivo.");
      }
    }
  }

  function renderContent() {
    if (fileState.uploading) {
      return (
        <RenderUploadingState
          progress={fileState.progress}
          file={fileState.file as File}
        />
      );
    }

    if (fileState.error) {
      return <RenderErrorState />;
    }

    if (showPreview && fileState.objectUrl && fileState.key) {
      return (
        <RenderPreviewState
          previewUrl={fileState.objectUrl}
          onConfirm={handleConfirm}
          onCancel={resetUploader}
          fileType={fileState.fileType}
        />
      );
    }

    if (fileState.objectUrl) {
      return (
        <RenderUploadedState
          previewUrl={fileState.objectUrl}
          isDeleting={fileState.isDeleting}
          handleDelete={removeFile}
          fileType={fileState.fileType}
        />
      );
    }

    return <RenderEmptyState isDragActive={isDragActive} />;
  }

  useEffect(() => {
    return () => {
      if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
        URL.revokeObjectURL(fileState.objectUrl);
      }
    };
  }, [fileState.objectUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:
      fileTypeAccepted === "image" ? { "image/*": [] } : { "video/*": [] },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_SIZE,
    onDropRejected: rejectedFiles,
    disabled: fileState.uploading || showPreview,
  });

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-40",
        isDragActive
          ? "border-primary bg-primary/10 border-solid"
          : "border-border hover:border-primary",
        showPreview && "border-solid"
      )}
    >
      <CardContent className="flex items-center justify-center h-full w-full">
        <input {...getInputProps()} />
        {renderContent()}
      </CardContent>
    </Card>
  );
}
