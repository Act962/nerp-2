"use client";

import { Button } from "@/components/ui/button";
import { usePdvCartStore } from "@/features/sales/pdv-cart-store";
import { useAppVersion } from "@/hooks/use-app-version";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

// Espera antes do recarregamento automático: tempo do operador ler o aviso e
// entender por que a tela vai piscar.
const AUTO_RELOAD_MS = 5000;

/**
 * Avisa que saiu deploy enquanto esta aba estava aberta.
 *
 * Sem isto, a aba só descobre o deploy ao pedir um chunk que não existe mais —
 * e aí já é tela de erro. Aqui o recarregamento acontece num MOMENTO SEGURO:
 * sozinho quando o carrinho está vazio, e só a pedido quando há venda em
 * andamento, para não arrancar itens da tela do operador no meio do
 * atendimento.
 */
export function NewVersionBanner() {
  const { newVersion } = useAppVersion();
  const itensNoCarrinho = usePdvCartStore((state) => state.items.length);
  const podeRecarregarSozinho = newVersion && itensNoCarrinho === 0;

  useEffect(() => {
    if (!podeRecarregarSozinho) return;
    const timer = setTimeout(() => window.location.reload(), AUTO_RELOAD_MS);
    return () => clearTimeout(timer);
  }, [podeRecarregarSozinho]);

  if (!newVersion) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm">
      <RefreshCw className="size-4 shrink-0 text-primary" />
      <span>
        {itensNoCarrinho > 0
          ? "Há uma versão nova do sistema. Finalize a venda em andamento e recarregue."
          : "Há uma versão nova do sistema. Recarregando em instantes..."}
      </span>
      <Button size="sm" onClick={() => window.location.reload()}>
        Recarregar agora
      </Button>
    </div>
  );
}
