"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function OrgLogoCard() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data } = useQuery(orpc.org.get.queryOptions({ input: undefined }));
  const logo = data?.organization.logo ?? null;

  const updateLogo = useMutation(
    orpc.org.updateLogo.mutationOptions({
      onSuccess: () => {
        toast.success("Logo atualizada");
        queryClient.invalidateQueries({ queryKey: orpc.org.get.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const busy = uploading || updateLogo.isPending;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    setUploading(true);
    try {
      const key = await uploadToR2(file);
      updateLogo.mutate({ logo: key });
    } catch {
      toast.error("Falha ao enviar a imagem");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo da organização</CardTitle>
        <CardDescription>
          Aparece no menu lateral e no perfil público (TradeGram). PNG ou SVG
          com fundo transparente funcionam melhor.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {logo ? (
            // biome-ignore lint/performance/noImgElement: logo por key do R2
            <img
              src={constructUrl(logo)}
              alt="Logo da organização"
              className="size-full object-contain"
            />
          ) : (
            <Building2 className="size-7 text-muted-foreground" />
          )}
        </span>

        <div className="flex flex-col items-start gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Spinner /> : <Upload className="size-4" />}
            {logo ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => updateLogo.mutate({ logo: null })}
            >
              Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
