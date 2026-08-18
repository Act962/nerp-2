"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import {
  useMediaTypes,
  useStoreSectors,
} from "@/features/trade-catalog/hooks/use-trade-catalog";
import { useEffect, useState } from "react";
import {
  type PdvPhoto,
  useCreatePdvPhoto,
  useUpdatePdvPhoto,
} from "../hooks/use-pdv-photos";
import { MultiPhotoUploader } from "./multi-photo-uploader";

const NONE = "__none__";

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface PdvPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mapObjectId?: string;
  defaultSupplierId?: string | null;
  defaultSection?: string | null;
  photo?: PdvPhoto;
}

export function PdvPhotoDialog({
  open,
  onOpenChange,
  storeId,
  mapObjectId,
  defaultSupplierId,
  defaultSection,
  photo,
}: PdvPhotoDialogProps) {
  const { suppliers } = useSupplier();
  const { storeSectors } = useStoreSectors();
  const { mediaTypes } = useMediaTypes();
  const createPdvPhoto = useCreatePdvPhoto();
  const updatePdvPhoto = useUpdatePdvPhoto();
  const isEditing = !!photo;

  const [photos, setPhotos] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState<string>(NONE);
  const [mediaTypeId, setMediaTypeId] = useState<string>(NONE);
  const [section, setSection] = useState("");
  const [company, setCompany] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [consultant, setConsultant] = useState("");
  const [code, setCode] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [capturedAt, setCapturedAt] = useState(today());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (photo) {
      setPhotos(photo.photos);
      setSupplierId(photo.supplierId ?? NONE);
      setMediaTypeId(photo.mediaTypeId ?? NONE);
      setSection(photo.section ?? "");
      setCompany(photo.responsibleCompany ?? "");
      setCoordinator(photo.coordinatorName ?? "");
      setConsultant(photo.consultantName ?? "");
      setCode(photo.code ?? "");
      setActionValue(
        photo.actionValue != null ? String(photo.actionValue) : "",
      );
      setCapturedAt(photo.capturedAt.slice(0, 10));
      setNotes(photo.notes ?? "");
      return;
    }
    setPhotos([]);
    setSupplierId(defaultSupplierId ?? NONE);
    setMediaTypeId(NONE);
    setSection(defaultSection ?? "");
    setCompany("");
    setCoordinator("");
    setConsultant("");
    setCode("");
    setActionValue("");
    setCapturedAt(today());
    setNotes("");
  }, [open, photo, defaultSupplierId, defaultSection]);

  const isPending = createPdvPhoto.isPending || updatePdvPhoto.isPending;

  // O rótulo mostra "PER - Perfumaria" (igual ao cadastro de Setores), mas o
  // valor gravado continua sendo só o nome — `PdvPhoto.section` é texto livre
  // e as fotos já salvas guardam o nome puro.
  const sectorOptions = storeSectors.map((sector) => ({
    value: sector.name,
    label: `${sector.code} - ${sector.name}`,
  }));
  // Fotos antigas podem ter uma seção que não existe mais no cadastro — entra
  // como opção extra pra não sumir silenciosamente ao editar.
  const hasCurrentSection = sectorOptions.some(
    (option) => option.value === section,
  );
  if (section && !hasCurrentSection) {
    sectorOptions.unshift({ value: section, label: section });
  }

  const handleSubmit = () => {
    if (photo) {
      updatePdvPhoto.mutate(
        {
          id: photo.id,
          supplierId: supplierId === NONE ? null : supplierId,
          mediaTypeId: mediaTypeId === NONE ? null : mediaTypeId,
          section: section || null,
          responsibleCompany: company || null,
          coordinatorName: coordinator || null,
          consultantName: consultant || null,
          code: code || null,
          actionValue: actionValue ? Number(actionValue) : null,
          photos,
          capturedAt: new Date(capturedAt).toISOString(),
          notes: notes || null,
        },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    createPdvPhoto.mutate(
      {
        storeId,
        mapObjectId,
        supplierId: supplierId === NONE ? undefined : supplierId,
        mediaTypeId: mediaTypeId === NONE ? undefined : mediaTypeId,
        section: section || undefined,
        responsibleCompany: company || undefined,
        coordinatorName: coordinator || undefined,
        consultantName: consultant || undefined,
        code: code || undefined,
        actionValue: actionValue ? Number(actionValue) : undefined,
        photos,
        capturedAt: new Date(capturedAt).toISOString(),
        notes: notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar foto do PDV" : "Nova foto do PDV"}
          </DialogTitle>
          <DialogDescription>
            Registre as fotos e os dados da visita ao ponto de venda.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <Field>
            <FieldLabel>Fotos</FieldLabel>
            <MultiPhotoUploader value={photos} onChange={setPhotos} />
          </Field>

          <div className="flex gap-4">
            <Field>
              <FieldLabel>Seção</FieldLabel>
              <Select
                value={section || NONE}
                onValueChange={(value) =>
                  setSection(value === NONE ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {sectorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="pdv-code">Código</FieldLabel>
              <Input
                id="pdv-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ex.: A12"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pdv-value">Valor (R$)</FieldLabel>
              <Input
                id="pdv-value"
                type="number"
                min={0}
                step="0.01"
                value={actionValue}
                onChange={(event) => setActionValue(event.target.value)}
                placeholder="Ex.: 250,00"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Tipo de mídia</FieldLabel>
            <Select value={mediaTypeId} onValueChange={setMediaTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de mídia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não informar</SelectItem>
                {mediaTypes.map((mediaType) => (
                  <SelectItem key={mediaType.id} value={mediaType.id}>
                    {mediaType.code} - {mediaType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Indústria</FieldLabel>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a indústria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="pdv-company">
              Empresa responsável pelo PDV
            </FieldLabel>
            <Input
              id="pdv-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Ex.: Agência de merchandising"
            />
          </Field>

          <div className="flex gap-4">
            <Field>
              <FieldLabel htmlFor="pdv-coordinator">Coordenador(a)</FieldLabel>
              <Input
                id="pdv-coordinator"
                value={coordinator}
                onChange={(event) => setCoordinator(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pdv-consultant">Consultor(a)</FieldLabel>
              <Input
                id="pdv-consultant"
                value={consultant}
                onChange={(event) => setConsultant(event.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="pdv-date">Data da visita</FieldLabel>
            <Input
              id="pdv-date"
              type="date"
              value={capturedAt}
              onChange={(event) => setCapturedAt(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="pdv-notes">Observações</FieldLabel>
            <Textarea
              id="pdv-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || photos.length === 0}
          >
            {isPending && <Spinner />}
            {isEditing ? "Salvar alterações" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
