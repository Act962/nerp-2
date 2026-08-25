"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ObservationsCardProps {
  observations: string;
  onObservationsChange: (value: string) => void;
}

export function ObservationsCard({
  observations,
  onObservationsChange,
}: ObservationsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observações</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Alguma observação sobre o pedido?"
          value={observations}
          onChange={(e) => onObservationsChange(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
