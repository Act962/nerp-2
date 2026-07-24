"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaptureWizard } from "./capture-wizard";
import { MyPhotosList } from "./my-photos-list";

export function PromotorApp({ promoterName }: { promoterName: string }) {
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
          <CaptureWizard promoterName={promoterName} />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <MyPhotosList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
