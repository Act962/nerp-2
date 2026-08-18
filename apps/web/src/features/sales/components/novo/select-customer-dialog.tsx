"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Search, User, Plus, Check } from "lucide-react";
import type { PersonType } from "@/schemas/customer";
import { useCustomer } from "@/features/custom/hooks/use-customer";
import type { CustomerSales } from "./create-sale";
import { AddCustomerModal } from "@/features/custom/components/add-customer";
import { CustomerHistoryDialog } from "@/features/sales/components/customer-history-dialog";

interface SelectCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomer?: CustomerSales;
  onSelect: (customer: CustomerSales) => void;
}

export function SelectCustomerDialog({
  open,
  onOpenChange,
  selectedCustomer,
  onSelect,
}: SelectCustomerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  // Popup do histórico de vendas — abre a partir do clique em "Ver histórico".
  const [historyFor, setHistoryFor] = useState<CustomerSales | null>(null);

  const { customers, isLoading } = useCustomer({});
  const filteredCustomers = customers?.filter(
    (c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    // ||      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (customer: CustomerSales) => {
    onSelect(customer);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onSelect({} as CustomerSales);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar Cliente</DialogTitle>
          <DialogDescription>
            Busque e selecione um cliente para a venda
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-start gap-2 rounded-lg border p-3 transition-all hover:border-primary hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(customer)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {customer.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {customer.personType === ("PF" as PersonType)
                            ? "Pessoa Física"
                            : "Pessoa Jurídica"}
                        </Badge>
                        {selectedCustomer?.id === customer.id && (
                          <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {customer.document}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {customer.email}
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => setHistoryFor(customer)}
                    title="Ver histórico de vendas deste cliente"
                  >
                    <History className="mr-1 h-3.5 w-3.5" />
                    Histórico
                  </Button>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <User className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Nenhum cliente encontrado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tente outro termo de busca
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            {selectedCustomer?.id && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setHistoryFor(selectedCustomer)}
                >
                  <History className="mr-2 h-4 w-4" />
                  Histórico
                </Button>
                <Button variant="secondary" onClick={handleRemove}>
                  Remover Cliente
                </Button>
              </>
            )}
            <AddCustomerModal>
              <Button className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </AddCustomerModal>
          </div>
        </div>
      </DialogContent>
      <CustomerHistoryDialog
        open={!!historyFor}
        onOpenChange={(next) => {
          if (!next) setHistoryFor(null);
        }}
        customer={historyFor}
      />
    </Dialog>
  );
}
