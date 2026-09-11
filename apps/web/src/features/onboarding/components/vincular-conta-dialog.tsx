"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useVincularConta,
  vincularComGoogle,
} from "../hooks/use-vincular-conta";

export function VincularContaDialog() {
  const { aberto, motivo, fechar } = useVincularConta();
  const [indo, setIndo] = useState(false);

  const continuar = async () => {
    setIndo(true);
    try {
      await vincularComGoogle();
    } catch {
      setIndo(false);
      toast.error("Não deu para abrir o Google agora. Tente de novo.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <DialogTitle>Crie sua conta para continuar</DialogTitle>
          </div>
          <DialogDescription>
            {motivo ? (
              <>
                Para <strong>{motivo}</strong>, a empresa precisa de um dono com
                conta de verdade.{" "}
              </>
            ) : null}
            Tudo o que você já fez aqui — produtos, clientes, catálogo e as
            Stars — continua seu. Leva um clique.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={indo}>
            Agora não
          </Button>
          <Button onClick={continuar} disabled={indo}>
            {indo ? <Loader2 className="size-4 animate-spin" /> : null}
            Continuar com o Google
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
