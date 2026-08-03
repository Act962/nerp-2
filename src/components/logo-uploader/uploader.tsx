"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";

import {
  RenderLogoEmptyState,
  RenderLogoUploadedState,
  RenderLogoUploadingState,
} from "./render-state";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { toast } from "sonner";

const MAX_SIZE = 1024 * 1024 * 2;

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

interface LogoUploaderProps {
  value?: string;
  onChange?: (value: string) => void;
  // fileTypeAccepted?: "image" | "video";
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const fileUrl = useConstructUrl(value || "");
  const [fileState, setFileState] = useState<UploaderState>({
    error: false,
    file: null,
    id: null,
    uploading: false,
    progress: 0,
    isDeleting: false,
    fileType: "image",
    key: value || undefined,
    objectUrl: value ? fileUrl : undefined,
  });

  /**
   * Adota o `value` que chega DEPOIS da montagem.
   *
   * Em todo formulário que carrega dados async — abrir "Editar fornecedor",
   * esperar a query, `form.reset()` preencher o campo — o `value` na primeira
   * renderização é `""`. O inicializador do `useState` roda só uma vez, então
   * sem esta sincronia o estado vazio vencia para sempre e a imagem só aparecia
   * na SEGUNDA abertura, quando a query já estava em cache e o valor existia na
   * montagem. Sem erro nenhum no caminho — só um avatar em branco.
   */
  useEffect(() => {
    setFileState((prev) => {
      // Upload ou remoção em curso mandam: o estado local é mais novo que a
      // prop, e trocar aqui apagaria a prévia no meio do envio.
      if (prev.uploading || prev.isDeleting) return prev;

      const key = value || undefined;
      if (prev.key === key) return prev;

      return {
        ...prev,
        file: null,
        id: null,
        progress: 0,
        error: false,
        key,
        objectUrl: key ? fileUrl : undefined,
      };
    });
  }, [value, fileUrl]);

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
            isImage: true,
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
              const precentageCompleted = (event.loaded / event.total) * 100;

              setFileState((prev) => ({
                ...prev,
                progress: Math.round(precentageCompleted),
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
    [onChange],
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

      setFileState(() => ({
        file: null,
        uploading: false,
        progress: 0,
        objectUrl: undefined,
        error: false,
        fileType: "image",
        id: null,
        isDeleting: false,
      }));

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
          fileType: "image",
        });

        uploadFile(file);
      }
    },
    [fileState.objectUrl, uploadFile],
  );

  function rejectedFiles(fileRejection: FileRejection[]) {
    if (fileRejection.length) {
      const tooManyFiles = fileRejection.find(
        (rejection) => rejection.errors[0].code === "too-many-files",
      );

      const fileSizeToBig = fileRejection.find(
        (rejection) => rejection.errors[0].code === "file-too-large",
      );

      if (fileSizeToBig) {
        toast.error("Arquivo muito grande, máximo de 2MB.");
      }

      if (tooManyFiles) {
        toast.error("Muitos arquivos selecionados, máximo de 1 arquivo.");
      }
    }
  }

  function renderContent() {
    if (fileState.uploading) {
      return (
        <RenderLogoUploadingState
          progress={fileState.progress}
          file={fileState.file as File}
        />
      );
    }

    if (fileState.objectUrl) {
      return (
        <RenderLogoUploadedState
          previewUrl={fileState.objectUrl}
          isDeleting={fileState.isDeleting}
          handleDelete={removeFile}
          fileType={fileState.fileType}
        />
      );
    }

    return <RenderLogoEmptyState isDragActive={isDragActive} />;
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_SIZE,
    onDropRejected: rejectedFiles,
  });

  useEffect(() => {
    return () => {
      if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
        URL.revokeObjectURL(fileState.objectUrl);
      }
    };
  }, [fileState.objectUrl]);

  return (
    <div className="flex flex-col items-center gap-4 ">
      <div {...getRootProps()} className="relative">
        <div
          className={cn(
            "group/avatar relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-dashed transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/20",
          )}
        >
          <input type="file" {...getInputProps()} />
          {renderContent()}
        </div>
      </div>

      <div className="text-center space-y-0.5">
        <p className="text-sm font-medium">
          {fileState.objectUrl ? "Logotipo enviado" : "Carregar logotipo"}
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPG até 2 MB</p>
      </div>

      {fileState.error && <p>Erro ao realizar upload</p>}
    </div>
  );
}

// async function makeRoundedImage(file: File): Promise<File> {
//   const img = new Image();
//   img.src = URL.createObjectURL(file);

//   await new Promise((resolve) => (img.onload = resolve));

//   const size = Math.min(img.width, img.height);
//   const canvas = document.createElement("canvas");
//   canvas.width = size;
//   canvas.height = size;

//   const ctx = canvas.getContext("2d")!;
//   ctx.clearRect(0, 0, size, size);

//   // máscara circular
//   ctx.beginPath();
//   ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
//   ctx.closePath();
//   ctx.clip();

//   // centraliza o crop
//   ctx.drawImage(
//     img,
//     (img.width - size) / 2,
//     (img.height - size) / 2,
//     size,
//     size,
//     0,
//     0,
//     size,
//     size
//   );

//   return new Promise((resolve) => {
//     canvas.toBlob(
//       (blob) => {
//         resolve(
//           new File([blob!], file.name.replace(/\.\w+$/, ".png"), {
//             type: "image/png",
//           })
//         );
//       },
//       "image/png",
//       1
//     );
//   });
// }
