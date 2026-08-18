"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/features/stores/hooks/use-stores";
import { ArrowLeft } from "lucide-react";
import {
  type PromotorPhotoStatus,
  useMyPhotoCounts,
  usePromotorProfile,
} from "../hooks/use-promotor";
import { CaptureWizard } from "./capture-wizard";
import { GpsStatusBanner } from "./gps-status-banner";
import { HereNowTab } from "./here-now-tab";
import { MyClientsList, MyIndustriesList } from "./my-links-list";
import { MyPhotosList, type RetakeTarget } from "./my-photos-list";
import { PromoterHeader, type PromotorView } from "./promoter-header";
import { PromoterCalendarSheet } from "./promoter-calendar-sheet";
import { PromoterOnboarding } from "./promoter-onboarding";
import { PromoterRouteTab } from "./promoter-route-tab";
import { PromoterProfileForm } from "./promoter-profile-form";

export type PromotorAppMode = "promotor" | "vendedor";

export function PromotorApp({
  promoterName,
  initialStoreId,
  initialSupplierId,
  mode = "promotor",
}: {
  promoterName: string;
  // Loja vinda por contexto (?storeId do /mapa): hidrata o nome e pula a etapa
  // de escolher a loja.
  initialStoreId?: string;
  // Indústria vinda por contexto (?supplierId da página de mídia): pré-seleciona
  // e pula direto para tirar a foto.
  initialSupplierId?: string;
  // "vendedor" adiciona a aba "Estou aqui" (mapa da localização) antes de
  // Capturar e a torna a aba inicial. "promotor" mantém o layout antigo.
  mode?: PromotorAppMode;
}) {
  const isSeller = mode === "vendedor";
  const { profile, isLoading: loadingProfile } = usePromotorProfile();
  const { store, isLoading } = useStore(initialStoreId ?? "");
  const initialStore =
    initialStoreId && store ? { id: store.id, name: store.name } : undefined;
  const waitingStore = !!initialStoreId && isLoading;
  const [view, setView] = useState<PromotorView>(isSeller ? "here" : "capture");
  const [editing, setEditing] = useState<"photo" | "whatsapp" | null>(null);
  // Filtro com que "Minhas fotos" abre. Serve ao atalho de reprovadas do
  // cabeçalho; vai como `key` para a lista remontar já no filtro certo.
  const [photosStatus, setPhotosStatus] = useState<PromotorPhotoStatus>("ALL");
  // Alvo do "Refazer foto": leva loja e indústria da reprovada para a captura.
  const [retake, setRetake] = useState<RetakeTarget | null>(null);
  // Overlay, não uma `PromotorView`: virar item do union o jogaria no ramo
  // `isSubPage` e desmontaria o wizard de captura pela metade.
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Loja escolhida na aba Rota. Estado próprio: `retake` carrega indústria
  // junto e sobrescrevê-lo aqui faria a captura herdar a indústria da última
  // foto reprovada.
  const [routeStore, setRouteStore] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { counts } = useMyPhotoCounts();

  if (loadingProfile) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  // Sem foto do rosto ou WhatsApp o app não abre. O servidor recusa a captura
  // de qualquer jeito (`promotor/capture.ts`); aqui só evitamos deixá-lo
  // percorrer o wizard inteiro para levar um erro no fim.
  if (profile && !profile.isComplete) {
    return (
      <PromoterOnboarding
        currentImage={profile.image}
        currentWhatsapp={profile.whatsapp}
      />
    );
  }

  const isSubPage = view === "industries" || view === "clients";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      {profile && (
        <PromoterHeader
          name={profile.name}
          image={profile.image}
          whatsapp={profile.whatsapp}
          orgName={profile.orgName}
          orgLogo={profile.orgLogo}
          rejectedCount={counts.rejected}
          onOpenCalendar={() => setCalendarOpen(true)}
          onOpenRejected={() => {
            setPhotosStatus("REJECTED");
            setView("photos");
          }}
          onNavigate={(next) => {
            if (next === "photos") setPhotosStatus("ALL");
            setView(next);
          }}
          onEditPhoto={() => setEditing("photo")}
          onEditWhatsapp={() => setEditing("whatsapp")}
        />
      )}

      <GpsStatusBanner />

      {isSubPage ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setView("capture")}
              aria-label="Voltar"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-lg font-semibold">
              {view === "industries" ? "Minhas indústrias" : "Meus clientes"}
            </h1>
          </div>
          {view === "industries" ? <MyIndustriesList /> : <MyClientsList />}
        </div>
      ) : (
        <Tabs
          value={
            view === "photos"
              ? "mine"
              : view === "route"
                ? "route"
                : view === "here"
                  ? "here"
                  : "capture"
          }
          onValueChange={(value) =>
            setView(
              value === "mine"
                ? "photos"
                : value === "route"
                  ? "route"
                  : value === "here"
                    ? "here"
                    : "capture",
            )
          }
        >
          <TabsList className="w-full">
            {isSeller && (
              <TabsTrigger value="here" className="flex-1">
                Estou aqui
              </TabsTrigger>
            )}
            <TabsTrigger value="capture" className="flex-1">
              Capturar
            </TabsTrigger>
            <TabsTrigger value="route" className="flex-1">
              Rota
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1">
              Minhas fotos
            </TabsTrigger>
          </TabsList>
          {isSeller && (
            <TabsContent value="here" className="mt-4">
              <HereNowTab />
            </TabsContent>
          )}
          <TabsContent value="capture" className="mt-4">
            {waitingStore ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <CaptureWizard
                key={
                  retake
                    ? `retake-${retake.store.id}-${retake.supplier.id}`
                    : routeStore
                      ? `rota-${routeStore.id}`
                      : "novo"
                }
                promoterName={profile?.name ?? promoterName}
                photoCredits={profile?.photoCredits}
                initialStore={retake?.store ?? routeStore ?? initialStore}
                initialSupplier={retake?.supplier}
                initialSupplierId={initialSupplierId}
                autoCapture={!!retake}
                onCaptured={() => {
                  setRetake(null);
                  setRouteStore(null);
                  setView("photos");
                }}
              />
            )}
          </TabsContent>
          <TabsContent value="route" className="mt-4">
            <PromoterRouteTab
              onCaptureAt={(store) => {
                setRetake(null);
                setRouteStore(store);
                setView("capture");
              }}
            />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyPhotosList
              key={photosStatus}
              initialStatus={photosStatus}
              onRetake={(target) => {
                setRetake(target);
                setView("capture");
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      <PromoterCalendarSheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing === "whatsapp"
                ? "Editar WhatsApp"
                : "Editar foto de perfil"}
            </DialogTitle>
            <DialogDescription>
              {editing === "whatsapp"
                ? "Número com DDD que a coordenação usa para falar com você."
                : "Foto do seu rosto (selfie) — não é a foto do ponto de venda."}
            </DialogDescription>
          </DialogHeader>
          {profile && editing && (
            <PromoterProfileForm
              fields={editing}
              currentImage={profile.image}
              currentWhatsapp={profile.whatsapp}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
