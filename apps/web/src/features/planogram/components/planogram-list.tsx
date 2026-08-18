"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreatePlanogram, usePlanograms } from "../hooks/use-planograms";

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  RASCUNHO: { label: "Rascunho", variant: "secondary" },
  EM_APROVACAO: { label: "Em aprovação", variant: "outline" },
  ATIVO: { label: "Ativo", variant: "default" },
  ARQUIVADO: { label: "Arquivado", variant: "secondary" },
};

export function PlanogramList() {
  const { planograms, isLoading } = usePlanograms();
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setOpenCreate(true)}>
          <PlusIcon className="size-4" />
          Novo planograma
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Planograma</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Categoria
                  </TableHead>
                  <TableHead className="text-center">Gôndolas</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Versão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: 6 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && planograms.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Nenhum planograma criado ainda.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  planograms.map((planogram) => {
                    const status =
                      STATUS_LABEL[planogram.status] ?? STATUS_LABEL.RASCUNHO;
                    return (
                      <TableRow key={planogram.id}>
                        <TableCell>
                          <Link
                            href={`/trade/planograma/${planogram.id}/editar`}
                            className="font-medium hover:underline"
                          >
                            {planogram.name}
                          </Link>
                          {planogram.code && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {planogram.code}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {planogram.categoryName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {planogram.fixturesCount}
                        </TableCell>
                        <TableCell className="text-center">
                          {planogram.itemsCount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          v{planogram.currentVersion}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreatePlanogramDialog open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}

function CreatePlanogramDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const createPlanogram = useCreatePlanogram();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo planograma</DialogTitle>
          <DialogDescription>
            Depois de criar, monte a gôndola e arraste os produtos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="pg-name">Nome</FieldLabel>
            <Input
              id="pg-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Limpeza — Lavanderia"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pg-code">Código (opcional)</FieldLabel>
            <Input
              id="pg-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ex.: LIMP-2026"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || createPlanogram.isPending}
            onClick={() =>
              createPlanogram.mutate(
                { name: name.trim(), code: code.trim() || undefined },
                {
                  onSuccess: (result) => {
                    onOpenChange(false);
                    router.push(`/trade/planograma/${result.id}/editar`);
                  },
                },
              )
            }
          >
            {createPlanogram.isPending && <Spinner />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
