"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Images,
  LayoutTemplate,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { useUpdatePdvPhoto } from "@/features/pdv-photos/hooks/use-pdv-photos";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatBRL } from "@/utils/currency-formatter";
import { cn } from "@/lib/utils";
import { useApplyBookPageTemplate } from "../../hooks/use-books";
import {
  NO_PAGE_TEMPLATE,
  PageTemplatePicker,
} from "../templates/page-template-picker";
import { LayoutPreview } from "../templates/layout-preview";
import type { BookVariableValues } from "../../lib/book-variables";
import type {
  PhotoAdjustment,
  PhotoAdjustmentMap,
} from "../../lib/photo-adjustment";
import {
  BookPagePhotoGrid,
  MAX_PHOTOS,
  type PhotoLayoutPattern,
} from "./book-page-photo-grid";
import { PageItemLayoutDialog } from "./page-item-layout-dialog";
import { BookStorePhotosDialog } from "./book-store-photos-dialog";
import { ImportPhotoDialog } from "./import-photo-dialog";
import { PhotoAdjustDialog } from "./photo-adjust-dialog";
import type { CoverElement } from "../../lib/cover-layout";

export interface BookPageItem {
  id: string;
  pdvPhotoId: string;
  hasOwnPageLayout: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote: string | null;
  reviewedByName: string | null;
  // Layout próprio da página; null = segue o do book.
  pageLayout: unknown;
  pageBackground: unknown;
  storeName: string;
  storeId: string | null;
  managerName: string | null;
  section: string | null;
  code: string | null;
  actionValue: number | null;
  coordinatorName: string | null;
  consultantName: string | null;
  photoLayout: PhotoLayoutPattern | null;
  photoAdjustments: PhotoAdjustmentMap | null;
  photos: string[];
}

interface BookPageCardProps {
  item: BookPageItem;
  bookId: string;
  periodLabel: string;
  position: number;
  total: number;
  industryLogo?: string | null;
  organizationName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  // Layout do book, usado quando a página não tem um próprio.
  bookPageLayout?: unknown;
  bookPageBackground?: unknown;
  logos?: { organization?: string | null; supplier?: string | null };
  onRemove: () => void;
}

function CollaboratorSelect({
  value,
  placeholder,
  onChange,
  collaboratorNames,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  collaboratorNames: string[];
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-auto w-full justify-start gap-1 border-none bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0 data-[placeholder]:text-neutral-400 data-[placeholder]:font-normal">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {collaboratorNames.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineField({
  value,
  placeholder,
  onChange,
  className,
  numeric,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <input
      type={numeric ? "number" : "text"}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full border-none bg-transparent p-0 outline-none placeholder:text-neutral-400 focus:ring-0 ${className ?? ""}`}
    />
  );
}

export function BookPageCard({
  item,
  bookId,
  periodLabel,
  position,
  total,
  industryLogo,
  organizationName,
  supplierId,
  supplierName,
  bookPageLayout,
  bookPageBackground,
  logos,
  onRemove,
}: BookPageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.pdvPhotoId });
  // silent: autosave em cada campo/foto/padrão — um toast por ação empilha
  // rápido (e um deles chegou a crescer e cobrir o botão "+" da grade).
  const updatePdvPhoto = useUpdatePdvPhoto({ silent: true });
  const { data: collaboratorsData } = useQueryCollaborators(true);
  const collaboratorNames = (collaboratorsData ?? []).map(
    (collaborator) => collaborator.name,
  );

  const [manager, setManager] = useState(item.managerName ?? "");
  const [section, setSection] = useState(item.section ?? "");
  const [code, setCode] = useState(item.code ?? "");
  const [coordinator, setCoordinator] = useState(item.coordinatorName ?? "");
  const [consultant, setConsultant] = useState(item.consultantName ?? "");
  const [actionValue, setActionValue] = useState(
    item.actionValue != null ? String(item.actionValue) : "",
  );
  // Estado local (não só a prop `item.photos`) porque uploads disparados em
  // sequência rápida (antes do primeiro round-trip terminar) usariam a
  // mesma foto "antiga" como base e um sobrescreveria o outro na API,
  // fazendo fotos recém-adicionadas sumirem. O updater funcional sempre
  // parte do valor mais recente, mesmo com mutations em voo.
  const [photos, setPhotos] = useState(item.photos);
  const [photoLayout, setPhotoLayout] = useState(item.photoLayout);
  const [photoAdjustments, setPhotoAdjustments] = useState(
    item.photoAdjustments ?? {},
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Instantâneo do que já está salvo. Um booleano de "pula a primeira" não
  // servia: em dev o StrictMode roda o effect duas vezes, a primeira passada
  // consumia o guard e a segunda gravava — uma escrita por página só de abrir
  // o book, o que deixava books grandes lentíssimos.
  const savedSnapshotRef = useRef(
    JSON.stringify([
      item.managerName ?? "",
      item.section ?? "",
      item.code ?? "",
      item.coordinatorName ?? "",
      item.consultantName ?? "",
      item.actionValue != null ? String(item.actionValue) : "",
    ]),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: useMutation recria `updatePdvPhoto` a cada render; incluí-lo redispararia o autosave em loop
  useEffect(() => {
    const snapshot = JSON.stringify([
      manager,
      section,
      code,
      coordinator,
      consultant,
      actionValue,
    ]);
    if (snapshot === savedSnapshotRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      savedSnapshotRef.current = snapshot;
      updatePdvPhoto.mutate({
        id: item.pdvPhotoId,
        managerName: manager || null,
        section: section || null,
        code: code || null,
        coordinatorName: coordinator || null,
        consultantName: consultant || null,
        actionValue: actionValue ? Number(actionValue) : null,
      });
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [manager, section, code, coordinator, consultant, actionValue]);

  const updatePhotos = (updater: (prev: string[]) => string[]) => {
    setPhotos((prev) => {
      const next = updater(prev);
      updatePdvPhoto.mutate({ id: item.pdvPhotoId, photos: next });
      return next;
    });
  };

  const saveLayoutPattern = (nextPattern: PhotoLayoutPattern | null) => {
    setPhotoLayout(nextPattern);
    updatePdvPhoto.mutate({ id: item.pdvPhotoId, photoLayout: nextPattern });
  };

  const applyPageTemplate = useApplyBookPageTemplate();
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [storePhotosOpen, setStorePhotosOpen] = useState(false);
  const hasOwnLayout = item.hasOwnPageLayout;
  // O picker não guarda qual padrão originou o layout — a cópia é por valor,
  // então só sabemos se a página tem layout próprio ou não.
  const pageTemplateValue = hasOwnLayout ? "" : NO_PAGE_TEMPLATE;

  const saveAdjustment = (key: string, adjustment: PhotoAdjustment) => {
    setPhotoAdjustments((prev) => {
      const next = { ...prev, [key]: adjustment };
      updatePdvPhoto.mutate({ id: item.pdvPhotoId, photoAdjustments: next });
      return next;
    });
  };

  // Layout que esta página vai usar no PDF: o próprio vence o do book.
  const layoutEfetivo = hasOwnLayout ? item.pageLayout : bookPageLayout;
  const fundoEfetivo = hasOwnLayout ? item.pageBackground : bookPageBackground;
  const temLayoutLivre =
    Array.isArray(layoutEfetivo) && layoutEfetivo.length > 0;

  // ── Espaços de foto clicáveis direto no preview do Conteúdo ────────────
  const slotElements = (
    Array.isArray(layoutEfetivo) ? (layoutEfetivo as CoverElement[]) : []
  ).filter((element) => element.type === "photoSlot");

  const slotInfo = (slotIndex: number) => {
    const slot = slotElements.find(
      (element) =>
        element.type === "photoSlot" && element.slotIndex === slotIndex,
    );
    if (slot?.type !== "photoSlot")
      return { aspectRatio: 1, objectFit: "cover" as const };
    return {
      aspectRatio: slot.height > 0 ? slot.width / slot.height : 1,
      objectFit: slot.objectFit,
    };
  };

  // Alinhado por índice de slot: a Nª foto do PDV preenche o Nº espaço.
  const photoAdjustmentsBySlot = photos.map((key) => photoAdjustments[key]);

  const [adjustingSlot, setAdjustingSlot] = useState<number | null>(null);
  const [importSlot, setImportSlot] = useState<number | null>(null);

  // Slot vazio abre o importador (cliente+indústria → fotos aprovadas ou
  // tirar/enviar na hora); slot preenchido abre o ajuste.
  const handleSlotClick = (slotIndex: number, hasPhoto: boolean) => {
    if (hasPhoto) {
      setAdjustingSlot(slotIndex);
      return;
    }
    setImportSlot(slotIndex);
  };

  const uploadSlotPhoto = (file: File): Promise<string> =>
    compressImage(file).then((compressed) => uploadToR2(compressed, true));

  const addKeyToSlot = (slotIndex: number, key: string) => {
    updatePhotos((prev) => {
      const next = [...prev];
      if (slotIndex < next.length) next[slotIndex] = key;
      else next.push(key);
      return next.slice(0, MAX_PHOTOS);
    });
  };

  const replacePhotoInSlot = async (slotIndex: number, file: File) => {
    const key = await uploadSlotPhoto(file);
    updatePhotos((prev) => {
      const next = [...prev];
      if (slotIndex < next.length) next[slotIndex] = key;
      return next;
    });
  };

  const adjustingKey =
    adjustingSlot != null ? photos[adjustingSlot] : undefined;

  const variaveisDaPagina: BookVariableValues = {
    loja: item.storeName,
    gerente: manager,
    coordenador: coordinator,
    consultor: consultant,
    empresaPdv: organizationName ?? "",
    secao: section,
    codigo: code,
    valorAcao: actionValue ? formatBRL(Number(actionValue) || 0) : "",
    numeroPagina: `${position} / ${total}`,
    periodo: periodLabel,
  };

  const camposEditaveis = (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Gerente
        </p>
        <InlineField
          value={manager}
          placeholder="—"
          onChange={setManager}
          className="text-sm font-bold"
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Coordenador(a)
        </p>
        <CollaboratorSelect
          value={coordinator}
          placeholder="—"
          onChange={setCoordinator}
          collaboratorNames={collaboratorNames}
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Consultor(a)
        </p>
        <CollaboratorSelect
          value={consultant}
          placeholder="—"
          onChange={setConsultant}
          collaboratorNames={collaboratorNames}
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Empresa PDV
        </p>
        <p className="text-sm font-bold">{organizationName || "—"}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Seção
        </p>
        <InlineField
          value={section}
          placeholder="—"
          onChange={setSection}
          className="text-sm font-bold"
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Código
        </p>
        <InlineField
          value={code}
          placeholder="—"
          onChange={setCode}
          className="text-sm font-bold"
        />
      </div>

      <div className="rounded-md border-l-4 border-[#c1121f] bg-[#c1121f]/5 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c1121f]">
          Valor da ação
        </p>
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-[#c1121f]">R$</span>
          <InlineField
            value={actionValue}
            placeholder="0,00"
            onChange={setActionValue}
            numeric
            className="text-lg font-bold text-[#c1121f]"
          />
        </div>
        {actionValue && (
          <p className="text-[10px] text-neutral-500">
            {formatBRL(Number(actionValue) || 0)}
          </p>
        )}
      </div>

      {industryLogo && (
        // biome-ignore lint/performance/noImgElement: preview simples de key do R2, sem otimização do next/image
        <img
          src={constructUrl(industryLogo)}
          alt=""
          className="max-h-36 max-w-full object-contain"
        />
      )}
    </div>
  );

  const gradeDeFotos = (
    <BookPagePhotoGrid
      photos={photos}
      layoutPattern={photoLayout}
      photoAdjustments={photoAdjustments}
      onChange={updatePhotos}
      onLayoutChange={saveLayoutPattern}
      onAdjustmentChange={saveAdjustment}
      editable
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        // O navegador pula o layout/paint dos cards fora da tela. Sem isso,
        // abrir um book grande renderiza dezenas de páginas 960x540 completas
        // de uma vez. `contain-intrinsic-size` reserva a altura pra barra de
        // rolagem não pular enquanto os cards entram em cena.
        contentVisibility: "auto",
        containIntrinsicSize: "auto 540px",
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white text-neutral-900 shadow-sm",
        // Sem layout livre o card imita a página 960x540; com layout, quem
        // define a proporção é o próprio preview.
        !temLayoutLivre && "md:aspect-[960/540]",
      )}
    >
      {/* Com layout livre a barra fica neutra e sem o nome da loja: o layout
          desenha o próprio cabeçalho, e repetir aqui dava a impressão de uma
          página dentro da outra. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 px-3 py-2 md:px-5",
          temLayoutLivre
            ? "justify-end border-b bg-neutral-100"
            : "justify-between bg-[#c1121f] py-3",
        )}
      >
        {!temLayoutLivre && (
          // No celular o nome quebra em até 2 linhas — nomes de supermercado
          // não cabem em 375px. No desktop segue truncando, senão uma segunda
          // linha estouraria o aspect-ratio fixo de 960x540 da página.
          <h3 className="line-clamp-2 min-w-0 text-base font-bold uppercase leading-tight tracking-tight text-white md:line-clamp-none md:truncate md:text-lg">
            {item.storeName}
          </h3>
        )}
        <div
          className={cn(
            "flex shrink-0 items-center gap-3",
            temLayoutLivre &&
              "[&_button]:bg-neutral-200 [&_button]:text-neutral-700 [&_button:hover]:bg-neutral-300",
          )}
        >
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              temLayoutLivre ? "text-neutral-500" : "text-white/90",
            )}
          >
            {periodLabel}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-white hover:bg-white/25 md:size-7",
                  // Destaque quando a página tem layout próprio, senão não dá
                  // pra saber pelo card que ela foge do padrão do book.
                  hasOwnLayout
                    ? "bg-white/40 ring-1 ring-white"
                    : "bg-white/15",
                )}
                title={
                  hasOwnLayout
                    ? "Esta página usa um padrão próprio"
                    : "Aplicar padrão de página"
                }
              >
                <LayoutTemplate className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <PageTemplatePicker
                supplierId={supplierId ?? null}
                value={pageTemplateValue}
                placeholder={
                  hasOwnLayout ? "Layout próprio desta página" : undefined
                }
                onChange={(templateId) =>
                  applyPageTemplate.mutate({
                    itemId: item.id,
                    templateId:
                      templateId === NO_PAGE_TEMPLATE ? null : templateId,
                  })
                }
                disabled={applyPageTemplate.isPending}
              />
              {/* Instrução, não descrição de estado: a frase antiga afirmava
                  "esta página tem layout próprio" bem na hora em que o usuário
                  tentava removê-lo, e parecia que o sistema estava recusando. */}
              <p className="mt-2 text-xs text-muted-foreground">
                {hasOwnLayout
                  ? "Para voltar ao layout do book, escolha “Seguir o layout do book”."
                  : "Escolha um padrão para dar a esta página um layout diferente do resto do book."}
              </p>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            className={cn(
              "flex size-9 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 md:size-7",
            )}
            title="Editar o layout desta página"
            onClick={() => setLayoutDialogOpen(true)}
          >
            <SquarePen className="size-4" />
          </button>
          {item.storeId && (
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 md:size-7"
              title="Ver e gerenciar as fotos aprovadas desta loja/cliente"
              onClick={() => setStorePhotosOpen(true)}
            >
              <Images className="size-4" />
            </button>
          )}
          <button
            type="button"
            // touch-none: sem isso o browser sequestra o gesto pro scroll
            // antes do dnd-kit enxergar o toque longo.
            className="flex size-9 cursor-grab touch-none items-center justify-center rounded-md bg-white/15 text-white active:cursor-grabbing md:size-7"
            title="Arraste para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 md:size-7"
            title="Remover página"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Com layout livre, a página É o layout escolhido — o corpo fixo abaixo
          não é renderizado. Os dados do PDV continuam editáveis no bloco
          recolhível, já que o preview em si não aceita digitação. */}
      {temLayoutLivre && (
        <>
          <LayoutPreview
            layout={layoutEfetivo}
            background={fundoEfetivo}
            variableValues={variaveisDaPagina}
            photoUrls={photos.map(constructUrl)}
            photoAdjustments={photoAdjustmentsBySlot}
            onSlotClick={handleSlotClick}
            logos={logos}
          />
          <p className="px-3 pt-2 text-center text-[11px] text-neutral-400 md:px-5">
            Toque num espaço de foto para trocar, reenquadrar ou desfocar o
            fundo.
          </p>
          <details className="border-t bg-neutral-50">
            <summary className="cursor-pointer px-3 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-600 md:px-5">
              Editar dados do PDV
            </summary>
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[240px_1fr] md:gap-5 md:p-5">
              {camposEditaveis}
              {gradeDeFotos}
            </div>
          </details>
        </>
      )}

      {!temLayoutLivre && (
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 md:min-h-0 md:grid-cols-[240px_1fr] md:gap-5 md:p-5">
          {/* No celular as fotos vêm primeiro: o promotor abriu a página pra
              fotografar, não pra preencher coordenador. */}
          <div className="order-2 overflow-y-auto md:order-1">
            {camposEditaveis}
          </div>
          <div className="order-1 flex min-h-0 flex-col md:order-2">
            {gradeDeFotos}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-end border-t px-5 py-2 text-xs text-neutral-500">
        {position} / {total}
      </div>

      {item.storeId && (
        <BookStorePhotosDialog
          open={storePhotosOpen}
          onOpenChange={setStorePhotosOpen}
          bookId={bookId}
          storeId={item.storeId}
          supplierId={supplierId ?? null}
          storeName={item.storeName}
        />
      )}

      {importSlot != null && (
        <ImportPhotoDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setImportSlot(null);
          }}
          bookId={bookId}
          defaultSupplierId={supplierId ?? null}
          defaultStoreId={item.storeId}
          onPick={(photo) => {
            addKeyToSlot(importSlot, photo.photoKey);
            setImportSlot(null);
          }}
        />
      )}

      {adjustingSlot != null && adjustingKey && (
        <PhotoAdjustDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setAdjustingSlot(null);
          }}
          photoUrl={constructUrl(adjustingKey)}
          aspectRatio={slotInfo(adjustingSlot).aspectRatio}
          objectFit={slotInfo(adjustingSlot).objectFit}
          allowBackdrop
          initialAdjustment={photoAdjustments[adjustingKey]}
          onSave={(adjustment) => saveAdjustment(adjustingKey, adjustment)}
          onReplacePhoto={(file) => {
            const slot = adjustingSlot;
            setAdjustingSlot(null);
            if (slot != null) replacePhotoInSlot(slot, file);
          }}
        />
      )}

      <PageItemLayoutDialog
        open={layoutDialogOpen}
        onOpenChange={setLayoutDialogOpen}
        bookId={bookId}
        itemId={item.id}
        storeName={item.storeName}
        supplierId={supplierId ?? null}
        supplierName={supplierName ?? null}
        layout={layoutEfetivo}
        background={fundoEfetivo}
        variableValues={variaveisDaPagina}
        photoPreviewUrls={photos.map(constructUrl)}
        logos={logos}
      />
    </div>
  );
}
