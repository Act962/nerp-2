"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import {
  useTradePricingSettings,
  useUpdateTradePricingSettings,
} from "../hooks/use-catalog-pdv";

export function PricingSettingsCard() {
  const { settings } = useTradePricingSettings();
  const update = useUpdateTradePricingSettings();

  const [markup, setMarkup] = useState("3");
  const [floorPrice, setFloorPrice] = useState("");

  useEffect(() => {
    if (!settings) return;
    setMarkup(String(settings.markup));
    setFloorPrice(
      settings.floorPrice != null ? String(settings.floorPrice) : "",
    );
  }, [settings]);

  const commitMarkup = () => {
    const parsed = Number(markup);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    update.mutate({ markup: parsed });
  };

  const commitFloorPrice = () => {
    const parsed = floorPrice ? Number(floorPrice) : null;
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) return;
    update.mutate({ floorPrice: parsed });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Precificação</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6">
        <div className="w-40 space-y-1.5">
          <label htmlFor="markup" className="text-sm text-muted-foreground">
            Markup
          </label>
          <Input
            id="markup"
            type="number"
            min={0}
            step="0.1"
            value={markup}
            onChange={(event) => setMarkup(event.target.value)}
            onBlur={commitMarkup}
          />
        </div>
        <div className="w-40 space-y-1.5">
          <label
            htmlFor="preco-minimo"
            className="text-sm text-muted-foreground"
          >
            Preço mínimo (R$)
          </label>
          <Input
            id="preco-minimo"
            type="number"
            min={0}
            step="0.01"
            placeholder="Sem mínimo"
            value={floorPrice}
            onChange={(event) => setFloorPrice(event.target.value)}
            onBlur={commitFloorPrice}
          />
        </div>
      </CardContent>
    </Card>
  );
}
