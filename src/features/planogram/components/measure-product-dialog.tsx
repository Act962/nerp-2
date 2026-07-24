"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProductRef } from "../engine/types";
import { parseCmToMm } from "../engine/units";
import { ProductPhotoField } from "./product-photo-field";

interface MeasureProductDialogProps {
  product: ProductRef | null;
  /** "place" posiciona na gôndola ao salvar; "edit" só atualiza o cadastro. */
  mode: "place" | "edit";
  onOpenChange: (open: boolean) => void;
  onMeasured: (product: ProductRef) => void;
}

/**
 * "Redimensionar Produto" — o equivalente ao modal do WebJasper.
 *
 * Nem todos os SKUs terão medida: este diálogo transforma o editor no caminho
 * natural de enriquecer o cadastro, em vez de mandar o usuário para outra tela
 * e perder o contexto do que estava montando.
 */
export function MeasureProductDialog({
  product,
  mode,
  onOpenChange,
  onMeasured,
}: MeasureProductDialogProps) {
  // A foto grava assim que é enviada; guardamos a chave para devolvê-la junto
  // no onMeasured, senão o editor repintaria com o thumbnail antigo.
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");

  const updateProduct = useMutation(
    orpc.planogram.updateProductDimensions.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );

  useEffect(() => {
    if (!product) return;
    setThumbnail(null);
    setWidth(product.widthMm ? String(product.widthMm / 10) : "");
    setHeight(product.heightMm ? String(product.heightMm / 10) : "");
    setDepth(product.depthMm ? String(product.depthMm / 10) : "");
  }, [product]);

  const widthMm = parseCmToMm(width);
  const heightMm = parseCmToMm(height);
  const depthMm = parseCmToMm(depth);
  const isValid =
    widthMm != null && heightMm != null && widthMm > 0 && heightMm > 0;

  async function handleSave() {
    if (!product || !isValid) return;
    await updateProduct.mutateAsync({
      id: product.id,
      widthMm,
      heightMm,
      depthMm: depthMm ?? undefined,
    });
    onMeasured({
      ...product,
      widthMm,
      heightMm,
      depthMm: depthMm ?? null,
      thumbnail: thumbnail ?? product.thumbnail,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Medidas e foto do produto</DialogTitle>
          <DialogDescription>
            {product?.name} ainda não tem medidas. Sem elas não é possível
            calcular frentes nem ocupação da gôndola.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel htmlFor="p-width">Largura (cm)</FieldLabel>
            <Input
              id="p-width"
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              placeholder="10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-height">Altura (cm)</FieldLabel>
            <Input
              id="p-height"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              placeholder="20"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-depth">Profund. (cm)</FieldLabel>
            <Input
              id="p-depth"
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
              placeholder="8"
            />
          </Field>
        </div>

        {product && (
          <ProductPhotoField
            productId={product.id}
            currentThumbnail={product.thumbnail}
            widthMm={widthMm}
            heightMm={heightMm}
            onPhotoChange={setThumbnail}
          />
        )}

        <p className="text-xs text-muted-foreground">
          Medidas e foto gravam no cadastro do produto e valem para todos os
          planogramas.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!isValid || updateProduct.isPending}
            onClick={handleSave}
          >
            {updateProduct.isPending && <Spinner />}
            {mode === "edit" ? "Salvar" : "Salvar e posicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
