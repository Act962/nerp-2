"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { useChecklistProgress } from "../hooks/use-calendario";

/**
 * Matriz "quem fez o quê": uma linha por (promotor, loja).
 *
 * Só gestão vê — é justamente a visão que o promotor não deve ter da execução
 * dos colegas.
 */
export function CalendarChecklistMatrix({ eventId }: { eventId: string }) {
  const { items, rows, isLoading } = useChecklistProgress(eventId, true);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-1 border-t pt-4">
        <p className="text-sm font-medium">Execução da equipe</p>
        <p className="text-xs text-muted-foreground">
          Ninguém marcou nada neste evento ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Execução da equipe</p>
      {/* Rolagem horizontal própria: com 6 itens de checklist a tabela passa da
        largura do painel, e o corpo da página não pode rolar de lado. */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Promotor</TableHead>
              {items.map((item) => (
                <TableHead key={item.id} className="min-w-24 text-xs">
                  {item.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.memberId}-${row.storeId ?? ""}`}>
                <TableCell className="text-xs">
                  <p className="font-medium">{row.memberName}</p>
                  {row.storeName && (
                    <p className="text-muted-foreground">{row.storeName}</p>
                  )}
                </TableCell>
                {items.map((item) => (
                  <TableCell key={item.id}>
                    {row.doneItemIds.includes(item.id) ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <X className="size-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
