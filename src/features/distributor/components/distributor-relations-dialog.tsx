"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDistributorRelations,
  useSetDistributorRelations,
} from "../hooks/use-distributor";

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Define quais indústrias o distribuidor representa e quais lojas ele atende —
// é o que liga indústria→distribuidor→loja no grafo de autorização.
export function DistributorRelationsDialog({
  distributorId,
  distributorName,
  open,
  onOpenChange,
}: {
  distributorId: string;
  distributorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { suppliers } = useSupplier({ pageSize: 100 });
  const { stores } = useStores();
  const { data, isLoading } = useDistributorRelations(
    open ? distributorId : "",
  );
  const save = useSetDistributorRelations();

  const [supplierIds, setSupplierIds] = useState<Set<string>>(new Set());
  const [storeIds, setStoreIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data) {
      setSupplierIds(new Set(data.supplierIds));
      setStoreIds(new Set(data.storeIds));
    }
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vínculos · {distributorName}</DialogTitle>
          <DialogDescription>
            Indústrias representadas e lojas atendidas por este distribuidor.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="grid min-h-0 gap-6 overflow-y-auto md:grid-cols-2">
            <section className="space-y-2">
              <h3 className="font-medium text-sm">
                Indústrias ({supplierIds.size})
              </h3>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={`d-sup-${supplier.id}`}
                      checked={supplierIds.has(supplier.id)}
                      onCheckedChange={() =>
                        setSupplierIds((set) => toggle(set, supplier.id))
                      }
                    />
                    <label
                      htmlFor={`d-sup-${supplier.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {supplier.name}
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-sm">Lojas ({storeIds.size})</h3>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={`d-store-${store.id}`}
                      checked={storeIds.has(store.id)}
                      onCheckedChange={() =>
                        setStoreIds((set) => toggle(set, store.id))
                      }
                    />
                    <label
                      htmlFor={`d-store-${store.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {store.name}
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  distributorId,
                  supplierIds: [...supplierIds],
                  storeIds: [...storeIds],
                },
                {
                  onSuccess: () => {
                    toast.success("Vínculos do distribuidor salvos");
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {save.isPending && <Spinner />}
            Salvar vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
