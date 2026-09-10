import { ShieldCheck } from "lucide-react";
import { AbrirVinculo } from "@/features/onboarding/components/abrir-vinculo";
import { requireAuth } from "@/lib/auth-utils";

// Destino do `requireContaVerificada()`: a página só abre o diálogo de
// vínculo já com o motivo. Se a organização já é verificada, o botão leva
// de volta ao dashboard.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  await requireAuth();
  const { motivo } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <ShieldCheck className="size-10 text-primary" />
      <h1 className="font-semibold text-xl">Crie sua conta para continuar</h1>
      <p className="text-muted-foreground text-sm">
        {motivo
          ? `Para ${motivo}, a empresa precisa de um dono com conta de verdade.`
          : "A empresa precisa de um dono com conta de verdade."}{" "}
        Tudo o que você já fez continua seu.
      </p>
      <AbrirVinculo motivo={motivo ?? null} />
    </div>
  );
}
