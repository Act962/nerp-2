"use client";

import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/features/stores/hooks/use-stores";
import { CaptureWizard } from "./capture-wizard";
import { MyPhotosList } from "./my-photos-list";

export function PromotorApp({
  promoterName,
  initialStoreId,
  initialSupplierId,
}: {
  promoterName: string;
  // Loja vinda por contexto (?storeId do /mapa): hidrata o nome e pula a etapa
  // de escolher a loja.
  initialStoreId?: string;
  // Indústria vinda por contexto (?supplierId da página de mídia): pré-seleciona
  // e pula direto para tirar a foto.
  initialSupplierId?: string;
}) {
  const { store, isLoading } = useStore(initialStoreId ?? "");
  const initialStore =
    initialStoreId && store ? { id: store.id, name: store.name } : undefined;
  const waitingStore = !!initialStoreId && isLoading;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Captura de fotos</h1>
      <Tabs defaultValue="capture">
        <TabsList className="w-full">
          <TabsTrigger value="capture" className="flex-1">
            Capturar
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex-1">
            Minhas fotos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="capture" className="mt-4">
          {waitingStore ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <CaptureWizard
              promoterName={promoterName}
              initialStore={initialStore}
              initialSupplierId={initialSupplierId}
            />
          )}
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <MyPhotosList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
