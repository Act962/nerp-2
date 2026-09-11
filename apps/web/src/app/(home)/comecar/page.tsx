import { Suspense } from "react";
import { WizardComecar } from "@/features/onboarding/components/wizard-comecar";

export const metadata = { title: "Começar agora — nerp" };

// Sem guarda: é a porta de quem ainda não tem conta. Quem já tem sessão é
// tratado no fim do wizard (vai para o dashboard ou para criar organização).
export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/30 px-4 py-10 sm:py-16">
      <Suspense>
        <WizardComecar />
      </Suspense>
    </div>
  );
}
