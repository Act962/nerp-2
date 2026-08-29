"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  History,
  Printer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuerySales } from "../hooks/use-sales";
import { PageHeader } from "@/components/page-header";
import { statusConfig } from "@/utils/status-sales-config";
import { currencyFormatter } from "@/utils/currency-formatter";
import { SaleDetailsDialog } from "./sale-details";
import { CustomerHistoryDialog } from "./customer-history-dialog";

const paymentMethodLabels: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CREDITO: "Crédito",
  DEBITO: "Débito",
  BOLETO: "Boleto",
};

export function SalesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  // Popup do histórico de vendas do cliente — abre a partir do menu de 3 pontos.
  const [historyCustomer, setHistoryCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoadingSales } = useQuerySales({
    status: undefined,
    dateInit: undefined,
    dateEnd: undefined,
    methodPayment: undefined,
    minValue: undefined,
    maxValue: undefined,
  });

  const filteredSales = data?.filter((sale) => {
    const matchesSearch =
      sale.saleNumber.toString().includes(searchTerm.toLowerCase()) ||
      sale.customer?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || sale.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleOpenChange = (open: boolean, id: string) => {
    setOpen(open);
    setSaleId(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" description="Gerencie todas as suas vendas">
        <Link href="/vendas/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Frente de caixa
          </Button>
        </Link>
      </PageHeader>
      <Tabs
        defaultValue="all"
        className="space-y-4"
        onValueChange={setStatusFilter}
      >
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="DRAFT">Rascunhos</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmadas</TabsTrigger>
          <TabsTrigger value="COMPLETED">Concluídas</TabsTrigger>
          <TabsTrigger value="CANCELLED">Canceladas</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou cliente..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select defaultValue="today">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table stacked>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => {
                      const status =
                        statusConfig[sale.status as keyof typeof statusConfig];
                      return (
                        <TableRow key={sale.id}>
                          <TableCell
                            data-label="Número"
                            className="font-mono font-medium"
                          >
                            {sale.saleNumber}
                          </TableCell>
                          <TableCell data-label="Cliente">
                            <div>
                              <div className="font-medium">
                                {sale.customer || "Cliente não informado"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {sale.items.length} itens
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-label="Data/Hora">
                            {formatDate(sale.date)}
                          </TableCell>
                          <TableCell data-label="Pagamento">
                            <Badge variant="outline">
                              {paymentMethodLabels[sale.paymentMethod || ""]}
                            </Badge>
                          </TableCell>
                          <TableCell data-label="Status">
                            <Badge className={status.className}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            data-label="Total"
                            className="text-right font-semibold"
                          >
                            {currencyFormatter(sale.total)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleOpenChange(true, sale.id)
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                {sale.customerId && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setHistoryCustomer({
                                        id: sale.customerId as string,
                                        name: sale.customer,
                                      })
                                    }
                                  >
                                    <History className="h-4 w-4 mr-2" />
                                    Histórico do cliente
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem>
                                  <Printer className="h-4 w-4 mr-2" />
                                  Imprimir nota
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar venda
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {filteredSales.length} de {data?.length} vendas
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm">
                    1
                  </Button>
                  <Button variant="outline" size="sm">
                    Próximo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {saleId && (
        <SaleDetailsDialog open={open} onOpenChange={setOpen} saleId={saleId} />
      )}
      <CustomerHistoryDialog
        open={!!historyCustomer}
        onOpenChange={(next) => {
          if (!next) setHistoryCustomer(null);
        }}
        customer={historyCustomer}
      />
    </div>
  );
}
