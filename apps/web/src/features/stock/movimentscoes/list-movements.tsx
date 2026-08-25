"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  PackageX,
  Pencil,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { CalendarFilter } from "@/features/products/components/filter-calendar";
import { FilterMoviments } from "./filters";
import { useQueryState } from "nuqs";
import { useStock } from "@/features/stock/hooks/use-stock";
import { Skeleton } from "@/components/ui/skeleton";
import dayjs from "dayjs";

const movementTypeConfig = {
  ENTRADA: {
    label: "Entrada",
    icon: ArrowDownRight,
    className: "bg-green-500 text-green-50",
  },
  SAIDA: {
    label: "Saída",
    icon: ArrowUpRight,
    className: "bg-orange-500 text-orange-50",
  },
  VENDA: {
    label: "Venda",
    icon: ArrowUpRight,
    className: "bg-primary text-primary-foreground",
  },
  COMPRA: {
    label: "Compra",
    icon: ArrowDownRight,
    className: "bg-green-500 text-green-50",
  },
  AJUSTE: {
    label: "Ajuste",
    icon: TrendingUp,
    className: "bg-secondary text-secondary-foreground",
  },
  PERDA: {
    label: "Perda",
    icon: PackageX,
    className: "bg-destructive text-destructive-foreground",
  },
};

export interface UserBase {
  id: string;
  name: string;
  email: string;
  image: string | null | undefined;
}

interface ListMovementsProps {
  members: UserBase[];
}

export function ListMovements({ members }: ListMovementsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [users] = useQueryState("users");

  const { data, isStockLoading } = useStock({
    limit: 100,
    offset: 1,
    userIds: users?.split(",").map((user) => user.trim()),
    dateInit: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
    dateEnd: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
  });

  const filteredMovements = data.filter((movement) => {
    const matchesSearch = movement.product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || movement.type === typeFilter;

    return matchesSearch && matchesType;
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
  return (
    <Tabs
      defaultValue="all"
      className="space-y-4"
      onValueChange={setTypeFilter}
    >
      <TabsList>
        <TabsTrigger value="all">Todas</TabsTrigger>
        <TabsTrigger value="ENTRADA">Entradas</TabsTrigger>
        <TabsTrigger value="SAIDA">Saídas</TabsTrigger>
        <TabsTrigger value="VENDA">Vendas</TabsTrigger>
        <TabsTrigger value="AJUSTE">Ajustes</TabsTrigger>
        <TabsTrigger value="PERDA">Perdas</TabsTrigger>
      </TabsList>

      <TabsContent value={typeFilter} className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por produto ou SKU..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CalendarFilter />
              <FilterMoviments members={members} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead className="text-center">
                      Estoque Anterior
                    </TableHead>
                    <TableHead className="text-center">Novo Estoque</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isStockLoading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center space-y-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!isStockLoading && data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        <span className="text-muted-foreground text-sm">
                          Nenhum movimento encontrado
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isStockLoading &&
                    filteredMovements.length > 0 &&
                    filteredMovements.map((movement) => {
                      const config =
                        movementTypeConfig[
                          movement.type as keyof typeof movementTypeConfig
                        ];
                      const Icon = config.icon;
                      return (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <Badge className={config.className}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {movement.product.name}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {movement.product.sku || "N/A"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`font-semibold ${
                                movement.quantity > 0
                                  ? "text-success"
                                  : "text-destructive"
                              }`}
                            >
                              {movement.quantity > 0 ? "+" : ""}
                              {movement.quantity} un
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {movement.previousStock} un
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {movement.newStock} un
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(movement.createdAt.toString())}
                          </TableCell>
                          <TableCell className="text-sm">
                            {movement.user.name.split(" ")[0]}{" "}
                            {movement.user.name.split(" ")[1]}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {movement.notes || "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {}}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {}}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {filteredMovements.length} de {data.length}{" "}
                movimentações
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
  );
}
