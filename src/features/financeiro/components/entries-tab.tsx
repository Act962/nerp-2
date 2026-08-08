"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useCancelEntry,
  useDeleteEntry,
  useEntries,
} from "@/features/financeiro/hooks/use-financeiro";
import {
  STATUS_LABEL,
  statusBadgeVariant,
} from "@/features/financeiro/lib/labels";
import { formatCents, formatDate } from "@/features/financeiro/lib/money";
import type {
  EntryStatus,
  EntryType,
  FinanceEntry,
} from "@/features/financeiro/lib/types";
import { cn } from "@/lib/utils";
import {
  BanknoteIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { EntryFormDialog } from "./entry-form-dialog";
import { PayEntryDialog } from "./pay-entry-dialog";

const ALL = "__all__";

const STATUS_OPTIONS: EntryStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
  "PENDING_APPROVAL",
];

export function EntriesTab() {
  const [typeFilter, setTypeFilter] = useState<EntryType | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<EntryStatus | typeof ALL>(
    ALL,
  );
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState<FinanceEntry | null>(null);

  const cancelEntry = useCancelEntry();
  const deleteEntry = useDeleteEntry();

  const { data, isPending } = useEntries({
    type: typeFilter === ALL ? undefined : typeFilter,
    status: statusFilter === ALL ? undefined : statusFilter,
    onlyOverdue: onlyOverdue || undefined,
    search: search || undefined,
  });

  const entries = data?.entries ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (entry: FinanceEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };
  const openPay = (entry: FinanceEntry) => {
    setPaying(entry);
    setPayOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por descrição"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as EntryType | typeof ALL)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="RECEIVABLE">A receber</SelectItem>
            <SelectItem value="PAYABLE">A pagar</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as EntryStatus | typeof ALL)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label
          htmlFor="only-overdue"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Switch
            id="only-overdue"
            checked={onlyOverdue}
            onCheckedChange={setOnlyOverdue}
          />
          Só vencidos
        </label>
        <Button className="ml-auto" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Novo lançamento
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const canPay =
                  entry.status !== "PAID" && entry.status !== "CANCELLED";
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <span
                        className={cn(
                          "mr-2 inline-block size-2 rounded-full align-middle",
                          entry.type === "RECEIVABLE"
                            ? "bg-emerald-500"
                            : "bg-red-500",
                        )}
                      />
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.categoryName ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        entry.overdue && "font-medium text-destructive",
                      )}
                    >
                      {formatDate(entry.dueDate)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        entry.type === "RECEIVABLE"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {formatCents(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCents(entry.paidAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(
                          entry.status,
                          entry.overdue,
                        )}
                      >
                        {entry.overdue && entry.status !== "OVERDUE"
                          ? "Vencido"
                          : STATUS_LABEL[entry.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVerticalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canPay && (
                            <DropdownMenuItem onClick={() => openPay(entry)}>
                              <BanknoteIcon className="size-4" />
                              Baixar
                            </DropdownMenuItem>
                          )}
                          {entry.status !== "PAID" && (
                            <DropdownMenuItem onClick={() => openEdit(entry)}>
                              <PencilIcon className="size-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canPay && (
                            <DropdownMenuItem
                              onClick={() =>
                                cancelEntry.mutate({ id: entry.id })
                              }
                            >
                              <XCircleIcon className="size-4" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => deleteEntry.mutate({ id: entry.id })}
                          >
                            <Trash2Icon className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EntryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
      />
      <PayEntryDialog open={payOpen} onOpenChange={setPayOpen} entry={paying} />
    </div>
  );
}
