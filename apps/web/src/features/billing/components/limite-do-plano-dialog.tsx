"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLimiteDoPlano } from "../hooks/use-limite-do-plano";
import { ROTULO_DO_RECURSO } from "../lib/planos";

/**
 * "Você chegou ao limite do plano." Abre sozinho quando qualquer cadastro
 * esbarra em `LimiteDoPlanoError` (ver `hooks/use-limite-do-plano.ts`).
 *
 * Só oferece planos, não Stars: ★ compram uso do Astro e do WhatsApp, não
 * vaga de cadastro. Misturar as duas coisas é como a pessoa compra 500 ★ e
 * continua sem conseguir cadastrar o 11º produto.
 */
export function LimiteDoPlanoDialog() {
  const { dados, fechar } = useLimiteDoPlano();

  if (!dados) return null;

  const rotulo = ROTULO_DO_RECURSO[dados.recurso];

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-amber-500" />
            <DialogTitle>Limite do plano {dados.plano}</DialogTitle>
          </div>
          <DialogDescription>
            Seu plano permite até <strong>{dados.limite}</strong>{" "}
            {dados.limite === 1 ? rotulo.singular : rotulo.plural}, e você já
            tem <strong>{dados.atual}</strong>. Para cadastrar mais, escolha um
            plano.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Continuar no {dados.plano}
          </Button>
          <Button asChild onClick={fechar}>
            <Link href="/configuracoes/planos">Ver planos</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
