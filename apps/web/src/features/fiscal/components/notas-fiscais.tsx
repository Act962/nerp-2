"use client";

import { FileArchive } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNumeracaoFiscal } from "../hooks/use-notas-fiscais";
import { AlertasFiscais } from "./alertas-fiscais";
import { NumeracaoFiscal } from "./numeracao-fiscal";
import { TabelaNotas } from "./tabela-notas";

/** O contador pede o mês FECHADO: o padrão é o mês anterior. */
function mesAnterior(): string {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function NotasFiscais() {
  const [mes, setMes] = useState(mesAnterior);
  const { data: numeracao } = useNumeracaoFiscal();
  const pulados = numeracao?.totalPulados ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notas fiscais"
        description="NFC-e emitidas pelo PDV: situação na SEFAZ, cancelamento, números pulados e os XMLs para o contador."
      >
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mes-exportacao">XMLs do mês</Label>
            <Input
              id="mes-exportacao"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-40"
            />
          </div>
          <Button asChild disabled={!mes}>
            <a href={`/api/fiscal/xml-mensal?mes=${mes}`}>
              <FileArchive className="size-4" />
              Baixar zip
            </a>
          </Button>
        </div>
      </PageHeader>

      <AlertasFiscais />

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas emitidas</TabsTrigger>
          <TabsTrigger value="numeracao">
            Numeração
            {pulados > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-700 dark:text-amber-400">
                {pulados}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notas" className="mt-4">
          <TabelaNotas />
        </TabsContent>
        <TabsContent value="numeracao" className="mt-4">
          <NumeracaoFiscal />
        </TabsContent>
      </Tabs>
    </div>
  );
}
