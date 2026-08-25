"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function NetworkSiglaCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery(orpc.org.get.queryOptions({ input: undefined }));
  const [sigla, setSigla] = useState("");

  useEffect(() => {
    if (data?.organization.sigla) setSigla(data.organization.sigla);
  }, [data?.organization.sigla]);

  const updateSigla = useMutation(
    orpc.org.updateSigla.mutationOptions({
      onSuccess: () => {
        toast.success("Sigla da rede salva");
        queryClient.invalidateQueries({ queryKey: orpc.org.get.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade da rede (PDV Map)</CardTitle>
        <CardDescription>
          Sigla curta usada no ID dos espaços do mapa (ex.: "WS" em
          WS-009-GD-002-PERF).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="network-sigla">Sigla</Label>
          <Input
            id="network-sigla"
            value={sigla}
            maxLength={8}
            placeholder="Ex.: WS"
            className="w-32 uppercase"
            onChange={(event) => setSigla(event.target.value.toUpperCase())}
          />
        </div>
        <Button
          type="button"
          disabled={updateSigla.isPending}
          onClick={() => updateSigla.mutate({ sigla: sigla || null })}
        >
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
