"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

/**
 * Recuperação da conta de teste que ficou sem organização (o hook do
 * `sign-in/anonymous` falhou no meio). Só aparece para sessão anônima.
 */
export function CriarSandboxButton() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const criar = useMutation(
    orpc.onboarding.criarSandbox.mutationOptions({
      onSuccess: async ({ organizationId }) => {
        await authClient.organization.setActive({ organizationId });
        router.push("/dashboard");
        router.refresh();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const anonimo = (session?.user as { isAnonymous?: boolean } | undefined)
    ?.isAnonymous;
  if (!anonimo) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={criar.isPending}
      onClick={() => criar.mutate({})}
    >
      {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      Criar minha empresa de teste
    </Button>
  );
}
