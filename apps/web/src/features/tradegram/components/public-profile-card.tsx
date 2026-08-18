"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function PublicProfileCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery(orpc.org.get.queryOptions({ input: undefined }));
  const isPublic = data?.organization.isPublicProfile ?? false;
  const slug = data?.organization.slug ?? "";
  const publicPath = `/tradegram/${slug}`;

  const update = useMutation(
    orpc.org.updatePublicProfile.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.isPublicProfile
            ? "Vitrine pública ativada"
            : "Vitrine pública desativada",
        );
        queryClient.invalidateQueries({ queryKey: orpc.org.get.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const copyUrl = () => {
    const url = `${window.location.origin}${publicPath}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vitrine pública (TradeGram)</CardTitle>
        <CardDescription>
          Quando ativa, qualquer pessoa com o link vê as lojas e o mapa desta
          rede, sem login. Valores de negociação nunca são expostos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-medium text-sm">Perfil público</p>
            <p className="text-muted-foreground text-xs">
              {isPublic ? "Acessível pelo link abaixo" : "Desativado"}
            </p>
          </div>
          <Switch
            checked={isPublic}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              update.mutate({ isPublicProfile: checked })
            }
          />
        </div>

        {isPublic && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <code className="flex-1 truncate text-xs">{publicPath}</code>
            <Button type="button" size="sm" variant="ghost" onClick={copyUrl}>
              <Copy className="size-3.5" /> Copiar
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <a href={publicPath} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Abrir
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
