"use client";

import { Camera, ShieldCheck, UserRound } from "lucide-react";
import { PromoterProfileForm } from "./promoter-profile-form";

/**
 * Primeiro acesso. Tela bloqueante: sem foto do rosto e WhatsApp o promotor não
 * chega ao wizard de captura (e o servidor recusa a captura de qualquer forma).
 *
 * O texto insiste na diferença entre selfie e foto de PDV porque é o erro
 * previsível — o app inteiro que ele conhece é "tirar foto do ponto de venda",
 * e a primeira tela pede uma foto com outra finalidade.
 */
export function PromoterOnboarding({
  currentImage,
  currentWhatsapp,
}: {
  currentImage: string | null;
  currentWhatsapp: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Complete seu cadastro</h1>
        <p className="text-sm text-muted-foreground">
          Precisamos da sua foto e do seu WhatsApp para identificar quem está em
          campo. É só uma vez.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p className="flex items-start gap-2 font-medium">
          <UserRound className="mt-0.5 size-4 shrink-0" />
          Foto do seu rosto (selfie)
        </p>
        <p className="mt-1 flex items-start gap-2 text-amber-800 dark:text-amber-200">
          <Camera className="mt-0.5 size-4 shrink-0" />
          Não é a foto do ponto de venda — essa você tira depois, na aba
          Capturar.
        </p>
      </div>

      <PromoterProfileForm
        fields="all"
        currentImage={currentImage}
        currentWhatsapp={currentWhatsapp}
        submitLabel="Concluir cadastro"
      />
    </div>
  );
}
