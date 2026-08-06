"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useDistributors } from "@/features/distributor/hooks/use-distributor";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMemberLinks, useSetMemberLinks } from "../hooks/use-promotor";

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function PromoterLinksManager() {
  const { data: members } = useQuery(
    orpc.members.list.queryOptions({ input: {} }),
  );
  const { suppliers } = useSupplier({ pageSize: 100 });
  const { stores } = useStores({ pageSize: 100 });
  const { data: distributors } = useDistributors();

  const [memberId, setMemberId] = useState("");
  const links = useMemberLinks(memberId);
  const save = useSetMemberLinks();

  const [supplierIds, setSupplierIds] = useState<Set<string>>(new Set());
  const [storeIds, setStoreIds] = useState<Set<string>>(new Set());
  const [distributorIds, setDistributorIds] = useState<Set<string>>(new Set());

  // Ao trocar de membro (ou carregar os vínculos), sincroniza a seleção local.
  useEffect(() => {
    if (!memberId) return;
    setSupplierIds(new Set(links.supplierIds));
    setStoreIds(new Set(links.storeIds));
    setDistributorIds(new Set(links.distributorIds ?? []));
  }, [memberId, links.supplierIds, links.storeIds, links.distributorIds]);

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-1.5">
        <p className="font-medium text-sm">Promotor</p>
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o promotor" />
          </SelectTrigger>
          <SelectContent>
            {(members ?? []).map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name} · {member.email}
                {member.role === "owner" || member.role === "admin"
                  ? " (admin)"
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!memberId ? (
        <p className="text-muted-foreground text-sm">
          Selecione um promotor para editar os vínculos.
        </p>
      ) : links.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
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
                      id={`sup-${supplier.id}`}
                      checked={supplierIds.has(supplier.id)}
                      onCheckedChange={() =>
                        setSupplierIds((set) => toggle(set, supplier.id))
                      }
                    />
                    <label
                      htmlFor={`sup-${supplier.id}`}
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
                      id={`store-${store.id}`}
                      checked={storeIds.has(store.id)}
                      onCheckedChange={() =>
                        setStoreIds((set) => toggle(set, store.id))
                      }
                    />
                    <label
                      htmlFor={`store-${store.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {store.name}
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium text-sm">
                Distribuidores ({distributorIds.size})
              </h3>
              <p className="text-muted-foreground text-xs">
                Autoriza o promotor nas lojas e indústrias que o distribuidor
                atende.
              </p>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {(distributors ?? []).length === 0 ? (
                  <p className="px-2 py-1.5 text-muted-foreground text-sm">
                    Nenhum distribuidor cadastrado.
                  </p>
                ) : (
                  (distributors ?? []).map((distributor) => (
                    <div
                      key={distributor.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        id={`dist-${distributor.id}`}
                        checked={distributorIds.has(distributor.id)}
                        onCheckedChange={() =>
                          setDistributorIds((set) =>
                            toggle(set, distributor.id),
                          )
                        }
                      />
                      <label
                        htmlFor={`dist-${distributor.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        {distributor.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <Button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                memberId,
                supplierIds: [...supplierIds],
                storeIds: [...storeIds],
                distributorIds: [...distributorIds],
              })
            }
          >
            {save.isPending && <Spinner />}
            Salvar vínculos
          </Button>
        </>
      )}
    </div>
  );
}
