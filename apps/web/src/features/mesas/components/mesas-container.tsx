"use client";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currencyFormatter } from "@/utils/currency-formatter";
import { LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import {
  useAtualizarMesa,
  useCriarMesas,
  useMesas,
} from "../hooks/use-mesas-admin";
import { FolhaDeQrs } from "./folha-de-qrs";

const ESQUELETO = ["a", "b", "c", "d", "e", "f"];

const ESTADO_ROTULO = {
  LIVRE: {
    texto: "Livre",
    classe:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  },
  CONSUMINDO: {
    texto: "Consumindo",
    classe:
      "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  },
  FECHANDO: {
    texto: "Fechando",
    classe: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  },
} as const;

export function MesasContainer() {
  const { data: mesas, isLoading } = useMesas(true);
  const criar = useCriarMesas();
  const atualizar = useAtualizarMesa();
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState("10");
  const [lugares, setLugares] = useState("");

  const lista = mesas ?? [];
  const ativas = lista.filter((mesa) => mesa.isActive);

  return (
    <div className="space-y-6">
      <PageHeader title="Mesas">
        <div className="flex gap-2">
          <FolhaDeQrs mesas={ativas} />
          <Button onClick={() => setAberto(true)}>
            <Plus className="size-4" />
            Criar mesas
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ESQUELETO.map((chave) => (
            <Skeleton key={chave} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>Nenhuma mesa cadastrada</EmptyTitle>
            <EmptyDescription>
              Crie as mesas de uma vez — "da 1 até a 20" — e imprima a folha de
              QRs para colar em cada uma.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((mesa) => {
            const rotulo = ESTADO_ROTULO[mesa.estado];
            return (
              <Card
                key={mesa.id}
                className={mesa.isActive ? "p-4" : "p-4 opacity-60"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      Mesa {mesa.number}
                      {mesa.name ? ` · ${mesa.name}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mesa.seats ? `${mesa.seats} lugares · ` : ""}
                      {mesa.total > 0
                        ? `R$ ${currencyFormatter(mesa.total).trim()} na conta`
                        : "sem conta aberta"}
                    </p>
                  </div>
                  <Badge className={rotulo.classe}>{rotulo.texto}</Badge>
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={atualizar.isPending}
                    onClick={() =>
                      atualizar.mutate({
                        id: mesa.id,
                        isActive: !mesa.isActive,
                      })
                    }
                  >
                    {mesa.isActive ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar mesas</DialogTitle>
            <DialogDescription>
              Cria a faixa inteira de uma vez. Número que já existe é pulado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="de">Da mesa</Label>
              <Input
                id="de"
                inputMode="numeric"
                value={de}
                onChange={(e) => setDe(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ate">Até a</Label>
              <Input
                id="ate"
                inputMode="numeric"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lugares">Lugares</Label>
              <Input
                id="lugares"
                inputMode="numeric"
                placeholder="—"
                value={lugares}
                onChange={(e) => setLugares(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={criar.isPending}
              onClick={() =>
                criar.mutate(
                  {
                    de: Number(de) || 1,
                    ate: Number(ate) || 1,
                    seats: lugares ? Number(lugares) : undefined,
                  },
                  { onSuccess: () => setAberto(false) },
                )
              }
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
