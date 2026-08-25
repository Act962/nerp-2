"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuerySupplier } from "../hooks/use-supplier";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BrandsManager } from "@/features/brands/components/brands-manager";
import {
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";

interface ViewSupplierProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewSupplier = ({ id, open, onOpenChange }: ViewSupplierProps) => {
  const { supplier, isLoading } = useQuerySupplier(id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do fornecedor</DialogTitle>
          <DialogDescription>
            Informações completas do fornecedor
          </DialogDescription>
        </DialogHeader>
        {isLoading && (
          <div className="flex flex-col items-center justify-center w-full py-8">
            <Spinner />
            <span>Carregando...</span>
          </div>
        )}
        {!isLoading && supplier && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{supplier.name}</h3>
              {supplier.tradeName && (
                <p className="text-sm text-muted-foreground">
                  {supplier.tradeName}
                </p>
              )}
              <Badge variant="outline">
                {supplier.personType === "FISICA"
                  ? "Pessoa Física"
                  : "Pessoa Jurídica"}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {supplier.document && (
                <div className="flex items-start gap-3 text-sm">
                  <FileTextIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">
                      {supplier.personType === "FISICA" ? "CPF" : "CNPJ"}
                    </p>
                    <p className="font-medium">{supplier.document}</p>
                  </div>
                </div>
              )}

              {supplier.email && (
                <div className="flex items-start gap-3 text-sm">
                  <MailIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{supplier.email}</p>
                  </div>
                </div>
              )}

              {supplier.phone && (
                <div className="flex items-start gap-3 text-sm">
                  <PhoneIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium">{supplier.phone}</p>
                  </div>
                </div>
              )}

              {supplier.contactPerson && (
                <div className="flex items-start gap-3 text-sm">
                  <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Pessoa de Contato</p>
                    <p className="font-medium">{supplier.contactPerson}</p>
                  </div>
                </div>
              )}

              {(supplier.address || supplier.city) && (
                <div className="flex items-start gap-3 text-sm md:col-span-2">
                  <MapPinIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Endereço</p>
                    <p className="font-medium">
                      {supplier.address && <span>{supplier.address}</span>}
                      {supplier.city && supplier.state && (
                        <span>
                          {supplier.address && <br />}
                          {supplier.city} - {supplier.state}
                          {supplier.zipCode && `, ${supplier.zipCode}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {supplier.notes && (
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-1">Observações</p>
                <p className="text-muted-foreground">{supplier.notes}</p>
              </div>
            )}

            <Separator />

            <BrandsManager supplierId={id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
