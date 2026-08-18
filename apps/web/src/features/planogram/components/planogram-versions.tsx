"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMm } from "../engine/units";
import { usePlanogramVersions } from "../hooks/use-planograms";

export function PlanogramVersions({ planogramId }: { planogramId: string }) {
  const { versions, isLoading } = usePlanogramVersions(planogramId);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead className="text-center">Produtos</TableHead>
                <TableHead className="text-center">Frentes</TableHead>
                <TableHead>Linear</TableHead>
                <TableHead>Salva por</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: 7 }).map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!isLoading && versions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma revisão salva. Use "Salvar no histórico" no editor
                    para congelar o estado atual.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">
                      v{version.version}
                    </TableCell>
                    <TableCell>
                      {version.label ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {version.itemCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {version.facingCount}
                    </TableCell>
                    <TableCell>{formatMm(version.linearMm)}</TableCell>
                    <TableCell>{version.createdByName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
