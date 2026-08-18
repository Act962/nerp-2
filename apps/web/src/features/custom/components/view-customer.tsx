import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryCustomer } from "../hooks/use-customer";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ViewCustomerProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewCustomer = ({ id, open, onOpenChange }: ViewCustomerProps) => {
  const { customer, isLoading } = useQueryCustomer(id);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const totalPurchases = customer?.sales.length || 0;
  const totalSpent =
    customer?.sales.reduce((acc, sale) => acc + Number(sale.total), 0) || 0;
  const lastPurchase = customer?.sales.reduce((acc, sale) => {
    if (!acc) return sale.createdAt;
    return sale.createdAt > acc ? sale.createdAt : acc;
  }, undefined as Date | undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do cliente</DialogTitle>
          <DialogDescription>
            Informações completas e histórico de compras
          </DialogDescription>
        </DialogHeader>
        {isLoading && (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Spinner />
            <span>Carregando...</span>
          </div>
        )}
        {!isLoading && customer && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {customer.name}
                  </h3>
                  <Badge variant="outline">
                    {customer.personType === "FISICA"
                      ? "Pessoa Física"
                      : "Pessoa Jurídica"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <FileTextIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">
                        {customer.personType === "FISICA" ? "CPF" : "CNPJ"}
                      </p>
                      <p className="font-medium">{customer.document}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <MailIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">E-mail</p>
                      <p className="font-medium">
                        {customer.email || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <PhoneIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Telefone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <MapPinIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {customer.address}
                        <br />
                        {customer.city} - {customer.state}, {customer.zipCode}
                      </p>
                    </div>
                  </div>
                </div>

                {customer.notes && (
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    <p className="font-medium mb-1">Observações</p>
                    <p className="text-muted-foreground">{customer.notes}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <Card>
                  <CardHeader className="">
                    <CardTitle className="text-sm font-medium">
                      Total de Compras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalPurchases}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      vendas realizadas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="">
                    <CardTitle className="text-sm font-medium">
                      Total Gasto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(totalSpent)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      valor total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="">
                    <CardTitle className="text-sm font-medium">
                      Última Compra
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {lastPurchase
                        ? formatDate(lastPurchase)
                        : "Nenhuma compra"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      data da última venda
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBagIcon className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Histórico de Compras</h3>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.sales.map((sale) => {
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.saleNumber}</TableCell>
                          <TableCell>{formatDate(sale.createdAt)}</TableCell>
                          <TableCell>{sale.paymentMethod}</TableCell>
                          <TableCell>{sale.status}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(Number(sale.total))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
