"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Codepage } from "@/features/receipt-designer/lib/escpos/encoding";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import type { AjustesDaImpressora } from "../hooks/use-impressora";

type Props = {
  ajustes: AjustesDaImpressora;
  aoSalvar: (ajustes: AjustesDaImpressora) => void;
  codepage: Codepage;
  aoTrocarCodepage: (codepage: Codepage) => void;
  aoImprimirTeste: () => Promise<void>;
};

/**
 * Ajustes por APARELHO, não por organização.
 *
 * Impressora térmica genérica mente sobre o que suporta: a mesma tabela de
 * caracteres que sai perfeita numa sai embaralhada na outra, e o tamanho de
 * bloco que uma engole a outra devolve picotado. Não há valor certo para
 * descobrir no código — há um botão de teste e os olhos de quem está na frente
 * da impressora.
 */
export function AjustesDaImpressoraDialog({
  ajustes,
  aoSalvar,
  codepage,
  aoTrocarCodepage,
  aoImprimirTeste,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [bloco, setBloco] = useState(String(ajustes.tamanhoDoBloco));
  const [pausa, setPausa] = useState(String(ajustes.pausaMs));
  const [testando, setTestando] = useState(false);

  const salvar = () => {
    aoSalvar({
      tamanhoDoBloco: Math.max(1, Math.min(512, Number(bloco) || 20)),
      pausaMs: Math.max(0, Math.min(500, Number(pausa) || 0)),
    });
    setAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Settings2 className="size-5" />
          Ajustes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustes da impressora</DialogTitle>
          <DialogDescription>
            Imprima o teste e escolha o que sair legível. Cada modelo responde
            de um jeito.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="codepage">Acentuação</Label>
            <Select
              value={codepage}
              onValueChange={(v) => aoTrocarCodepage(v as Codepage)}
            >
              <SelectTrigger id="codepage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CP860">CP860 — português</SelectItem>
                <SelectItem value="CP850">CP850 — multilíngue</SelectItem>
                <SelectItem value="CP437">CP437 — sem acento</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              No teste deve sair: ÁÉÍÓÚ ÃÕ ÇÑ º ª
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bloco">Bytes por envio</Label>
              <Input
                id="bloco"
                inputMode="numeric"
                value={bloco}
                onChange={(e) => setBloco(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comece em 20. Cupom picotado = baixe.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pausa">Pausa (ms)</Label>
              <Input
                id="pausa"
                inputMode="numeric"
                value={pausa}
                onChange={(e) => setPausa(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Impressão lenta demais? Reduza.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={testando}
            onClick={async () => {
              setTestando(true);
              try {
                await aoImprimirTeste();
              } finally {
                setTestando(false);
              }
            }}
          >
            Imprimir teste
          </Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
