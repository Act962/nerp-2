"use client";

import { LogoUploader } from "@/components/logo-uploader/uploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePlus, Type } from "lucide-react";
import { useState } from "react";
import { SenhaImageEditor } from "./senha-image-editor";

/**
 * A imagem da senha do mês, por upload ou escrita na hora.
 *
 * As duas abas gravam no MESMO campo — a chave do R2 —, então nada muda para o
 * carimbo da foto do promotor nem para o resto do sistema: ele continua vendo
 * uma imagem, sem saber de onde veio.
 */
export function SenhaImageField({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [tab, setTab] = useState<"upload" | "editor">("upload");

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as "upload" | "editor")}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="gap-1.5">
          <ImagePlus className="size-4" />
          Enviar imagem
        </TabsTrigger>
        <TabsTrigger value="editor" className="gap-1.5">
          <Type className="size-4" />
          Escrever
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-3">
        <LogoUploader value={value} onChange={onChange} />
      </TabsContent>

      <TabsContent value="editor" className="mt-3">
        <SenhaImageEditor
          onGenerated={(key) => {
            onChange?.(key);
            // Volta para o upload para a pessoa VER o resultado no mesmo lugar
            // onde a imagem enviada apareceria — e poder trocar ou remover.
            setTab("upload");
          }}
        />
      </TabsContent>
    </Tabs>
  );
}
