"use client";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useInventoryCounts } from "../hooks/use-inventory";

const STATUS: Record<
  string,
  { label: string; variant: "secondary" | "outline" }
> = {
  OPEN: { label: "Em contagem", variant: "secondary" },
  APPLIED: { label: "Aplicada", variant: "outline" },
  CANCELLED: { label: "Descartada", variant: "outline" },
};

export function InventoryList() {
  const { data, isPending } = useInventoryCounts();
  const counts = data?.counts ?? [];

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contagem</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center">
                <Spinner />
              </TableCell>
            </TableRow>
          ) : counts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-muted-foreground"
              >
                Nenhuma contagem ainda. Abra uma pelo Coletor.
              </TableCell>
            </TableRow>
          ) : (
            counts.map((count) => (
              <TableRow key={count.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/estoque/inventarios/${count.id}`}
                    className="hover:underline"
                  >
                    {count.name}
                  </Link>
                  {count.blind && (
                    <Badge variant="outline" className="ml-2">
                      cega
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {count.itemCount}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS[count.status]?.variant ?? "outline"}>
                    {STATUS[count.status]?.label ?? count.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(count.startedAt).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
