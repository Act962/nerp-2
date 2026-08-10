"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cloud, Loader2, Unplug } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Card da conexão Google Drive dentro da página /integracoes. Fluxo:
//   [Desconectado] → botão "Conectar Google Drive" (redireciona pra OAuth do server)
//   [Conectado]    → mostra e-mail + botão "Desconectar"
// A leitura de pasta e o import ficam em /produtos/importar-imagens (outra tela).

export function GoogleDriveCard() {
  const queryClient = useQueryClient();
  const conn = useQuery(
    orpc.googleDrive.getConnection.queryOptions({ input: {} }),
  );
  const disconnect = useMutation(
    orpc.googleDrive.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success("Google Drive desconectado");
        queryClient.invalidateQueries({
          queryKey: orpc.googleDrive.getConnection.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
            <Cloud className="size-5" />
          </div>
          <div>
            <CardTitle>Google Drive</CardTitle>
            <CardDescription>
              Conecte uma conta Google pra importar imagens de produtos em massa
              a partir de uma pasta do Drive.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {conn.isPending ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : conn.data?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span>
              Conectado como <strong>{conn.data.email}</strong>
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/produtos/importar-imagens">Importar imagens</a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate({})}
              >
                <Unplug className="mr-1 size-4" />
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Nenhuma conta conectada.
            </span>
            <Button asChild>
              <a href="/api/integrations/google/authorize">
                <Cloud className="mr-2 size-4" />
                Conectar Google Drive
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
