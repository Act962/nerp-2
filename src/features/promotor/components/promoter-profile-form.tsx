"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import {
  formatWhatsapp,
  maskWhatsapp,
  normalizeWhatsapp,
} from "@/lib/whatsapp";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUpdatePromotorProfile } from "../hooks/use-promotor";
import { SelfieCaptureInput } from "./selfie-capture-input";

type Fields = "all" | "photo" | "whatsapp";

/**
 * Formulário da identificação do promotor. Um só componente para os três usos
 * (primeiro acesso, editar foto, editar WhatsApp) porque o upload da selfie é
 * o mesmo nos três — duplicá-lo é onde o bug de "salvou a chave em vez da URL"
 * costuma aparecer em um dos caminhos e não nos outros.
 */
export function PromoterProfileForm({
  fields = "all",
  currentImage,
  currentWhatsapp,
  submitLabel = "Salvar",
  onSaved,
}: {
  fields?: Fields;
  currentImage: string | null;
  currentWhatsapp: string | null;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const showPhoto = fields === "all" || fields === "photo";
  const showWhatsapp = fields === "all" || fields === "whatsapp";

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState(
    currentWhatsapp ? formatWhatsapp(currentWhatsapp) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = useUpdatePromotorProfile();
  const busy = uploading || update.isPending;

  // Object URL criada dentro do efeito para o cleanup revogar exatamente a que
  // saiu de uso (mesmo cuidado do StampEditor com o StrictMode).
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shownImage =
    preview ?? (currentImage ? constructUrl(currentImage) : null);

  const submit = async () => {
    setError(null);

    // No modo "só foto" exigimos um arquivo novo: salvar sem escolher nada
    // mandaria um update vazio ao servidor, que responde "Nada para atualizar".
    if (showPhoto && !file && (fields === "photo" || !currentImage)) {
      setError(
        fields === "photo"
          ? "Escolha uma nova foto do seu rosto"
          : "Envie uma foto do seu rosto",
      );
      return;
    }

    let normalized: string | undefined;
    if (showWhatsapp) {
      const value = normalizeWhatsapp(whatsapp);
      if (!value) {
        setError("Informe um WhatsApp válido com DDD — ex.: (11) 99999-9999");
        return;
      }
      normalized = value;
    }

    let imageUrl: string | undefined;
    if (file) {
      setUploading(true);
      try {
        // URL absoluta, não a chave: `user.image` é lido cru como `src` na
        // sidebar e nos avatares do ERP.
        const key = await uploadToR2(await compressImage(file), true);
        imageUrl = constructUrl(key);
      } catch {
        setUploading(false);
        toast.error("Não foi possível enviar a foto, tente novamente");
        return;
      }
      setUploading(false);
    }

    update.mutate(
      { image: imageUrl, whatsapp: normalized },
      { onSuccess: () => onSaved?.() },
    );
  };

  return (
    <div className="space-y-4">
      {showPhoto && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
            {shownImage ? (
              // biome-ignore lint/performance/noImgElement: preview local ou URL do R2
              <img
                src={shownImage}
                alt="Sua foto de perfil"
                className="size-full object-cover"
              />
            ) : (
              <UserRound className="size-10 text-muted-foreground" />
            )}
          </div>
          <SelfieCaptureInput onFile={setFile} disabled={busy} />
        </div>
      )}

      {showWhatsapp && (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="promotor-whatsapp">WhatsApp</FieldLabel>
            <Input
              id="promotor-whatsapp"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(11) 99999-9999"
              value={whatsapp}
              onChange={(event) =>
                setWhatsapp(maskWhatsapp(event.target.value))
              }
              disabled={busy}
            />
            <FieldDescription>
              Número com DDD, o mesmo do seu WhatsApp — é por ele que a
              coordenação fala com você.
            </FieldDescription>
          </Field>
        </FieldGroup>
      )}

      {error && <FieldError>{error}</FieldError>}

      <Button
        type="button"
        className="h-12 w-full gap-2"
        disabled={busy}
        onClick={submit}
      >
        {busy && <Spinner />}
        {uploading ? "Enviando foto…" : submitLabel}
      </Button>
    </div>
  );
}
