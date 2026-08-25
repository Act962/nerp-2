"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  EditIcon,
  EyeIcon,
  MoreVerticalIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react";
import { useCustomer } from "../hooks/use-customer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarFilter } from "@/features/products/components/filter-calendar";
import { FilterClients } from "./filter";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { PersonType } from "@/generated/prisma/enums";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ViewCustomer } from "./view-customer";
import { EditCustomer } from "./edit-customer";
import { DeleteCustomer } from "./delete-customer";

export function ListCustomers() {
  const [personType] = useQueryState("person_type");
  const [minPurchase] = useQueryState("min_purchase");
  const [maxPurchase] = useQueryState("max_purchase");
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [customerId, setCustomerId] = useState("");
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [openEditCustomerModal, setOpenEditCustomerModal] = useState(false);
  const [openDeleteCustomerModal, setOpenDeleteCustomerModal] = useState(false);

  const { customers, isLoading } = useCustomer({
    personType: personType ? (personType as PersonType) : undefined,
    minPurchase: minPurchase ? Number(minPurchase) / 100 : undefined,
    maxPurchase: maxPurchase ? Number(maxPurchase) / 100 : undefined,
    dateIni: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
    dateEnd: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Buscar cliente..." />
            </InputGroup>
            <CalendarFilter />
            <FilterClients />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-right">Total de Compras</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                  <TableHead className="text-right">Última Compra</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow className="h-24">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <TableCell key={index}>
                        {Array.from({ length: 8 }).map((_, index) => (
                          <Skeleton key={index} className="h-4 w-full mt-2" />
                        ))}
                      </TableCell>
                    ))}
                  </TableRow>
                )}

                {!isLoading && customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  customers.length > 0 &&
                  customers.map((customer) => {
                    const totalPurchases = customer.sales?.length || 0;
                    const totalSpent = customer.sales?.reduce(
                      (acc, sale) => acc + (Number(sale.total) || 0),
                      0,
                    );
                    const lastPurchase = customer.sales?.[0]?.createdAt
                      ? new Date(
                          customer.sales?.[0]?.createdAt,
                        ).toLocaleDateString()
                      : "N/A";

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {customer.document ? customer.document : "..."}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {customer.personType === "FISICA"
                              ? "Pessoa Física"
                              : "Pessoa Jurídica"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{customer.phone}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {customer.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.city && customer.state
                            ? `${customer.city}/${customer.state}`
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ShoppingBagIcon className="size-4 text-muted-foreground" />
                            <span className="font-medium">
                              {totalPurchases}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(totalSpent)}
                        </TableCell>
                        <TableCell className="text-right">
                          {lastPurchase}
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVerticalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setCustomerId(customer.id);
                                  setOpenCustomerModal(true);
                                }}
                              >
                                <EyeIcon className="size-4 mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setCustomerId(customer.id);
                                  setOpenEditCustomerModal(true);
                                }}
                              >
                                <EditIcon className="size-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setCustomerId(customer.id);
                                  setOpenDeleteCustomerModal(true);
                                }}
                              >
                                <Trash2Icon className="size-4 mr-2" />
                                Excluir
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
        </CardContent>
      </Card>

      <ViewCustomer
        id={customerId}
        open={openCustomerModal}
        onOpenChange={setOpenCustomerModal}
      />
      <EditCustomer
        id={customerId}
        open={openEditCustomerModal}
        onOpenChange={setOpenEditCustomerModal}
      />
      <DeleteCustomer
        id={customerId}
        open={openDeleteCustomerModal}
        onOpenChange={setOpenDeleteCustomerModal}
      />
    </>
  );
}
