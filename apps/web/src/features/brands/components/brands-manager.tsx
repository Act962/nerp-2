"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LogoUploader } from "@/components/logo-uploader/uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { ImageOffIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useBrands, useCreateBrand, useDeleteBrand } from "../hooks/use-brands";

interface BrandsManagerProps {
  supplierId: string;
}

export function BrandsManager({ supplierId }: BrandsManagerProps) {
  const { brands, isLoading } = useBrands(supplierId);
  const createBrand = useCreateBrand();
  const deleteBrand = useDeleteBrand();

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    createBrand.mutate(
      { supplierId, name: name.trim(), logo: logo || undefined },
      {
        onSuccess: () => {
          setName("");
          setLogo("");
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Marcas da indústria</h4>
        <p className="text-xs text-muted-foreground">
          As logos cadastradas aqui aparecem nos Books de PDV desta indústria.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma marca cadastrada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {brand.logo ? (
                  <Image
                    src={constructUrl(brand.logo)}
                    alt={brand.name}
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                ) : (
                  <ImageOffIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <span className="flex-1 truncate text-sm font-medium">
                {brand.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                onClick={() => deleteBrand.mutate({ id: brand.id })}
                disabled={deleteBrand.isPending}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="brand-name">Nova marca</FieldLabel>
            <Input
              id="brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: KitKat"
              disabled={createBrand.isPending}
            />
          </Field>
          <Field>
            <FieldLabel>Logo da marca</FieldLabel>
            <LogoUploader value={logo} onChange={setLogo} />
          </Field>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={createBrand.isPending || !name.trim()}
          >
            {createBrand.isPending && <Spinner />}
            Adicionar marca
          </Button>
        </FieldGroup>
      </div>
    </div>
  );
}
