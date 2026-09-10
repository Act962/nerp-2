"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAvisos } from "@/features/astro/hooks/use-avisos";
import { cn } from "@/lib/utils";

/**
 * O sino do cabeçalho.
 *
 * É o caminho de quem não quer conversar: o mascote fala o aviso mais grave,
 * e quem prefere ler a lista inteira vem por aqui. Sem aviso aberto ele fica
 * apagado, e não some — um ícone que aparece e desaparece do cabeçalho move
 * os outros de lugar a cada minuto.
 */
export function SinoDeAvisos() {
  const { data } = useAvisos();
  const naoLidos = data?.naoLidos ?? 0;

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={
        naoLidos > 0 ? `Avisos do Astro (${naoLidos})` : "Avisos do Astro"
      }
    >
      <Link href="/configuracoes/avisos">
        <Bell
          className={cn("size-5", naoLidos === 0 && "text-muted-foreground")}
        />
        {naoLidos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {naoLidos > 9 ? "9+" : naoLidos}
          </span>
        )}
      </Link>
    </Button>
  );
}
