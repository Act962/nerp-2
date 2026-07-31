"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStores } from "@/features/stores/hooks/use-stores";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  QrCodeIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { StoreQrDialog } from "./store-qr-dialog";

// Seletor de loja para o App QR Preço.
//
// O app em si é público e por loja: quem escaneia o QR colado na gôndola já
// entra na loja certa e nunca vê esta tela. Ela existe só para o gestor abrir o
// app de uma loja sem precisar caçar o QR impresso ou montar a URL na mão.
export function QrPriceStores() {
  const [search, setSearch] = useState("");
  const [qrStoreId, setQrStoreId] = useState<string | null>(null);
  const { stores, isLoading } = useStores(search || undefined);
  const { data: orgData } = useQuery(
    orpc.org.get.queryOptions({ input: undefined }),
  );

  const slug = orgData?.organization.slug ?? null;
  const isPublicProfile = orgData?.organization.isPublicProfile ?? false;

  const scanUrl = (storeId: string) =>
    slug ? `/tradegram/${slug}/${storeId}/scan` : null;

  return (
    <div className="space-y-4">
      {orgData && !isPublicProfile && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            O <strong>Perfil Público</strong> da organização está desligado —
            enquanto isso o app não abre para ninguém, nem pelo QR da loja.
            Ative em <strong>TradeGram</strong>.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar loja"
            />
          </InputGroup>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : stores.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              {search
                ? "Nenhuma loja encontrada."
                : "Cadastre uma loja em Lojas e Mapas para usar o app."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">App</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => {
                  const url = scanUrl(store.id);
                  // O app público só resolve loja ATIVA — abrir uma inativa cai
                  // em "Loja não encontrada", então nem oferecemos o link.
                  const canOpen = !!url && store.isActive && isPublicProfile;

                  return (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{store.name}</span>
                          {store.code && (
                            <span className="text-muted-foreground text-xs">
                              {store.code}
                            </span>
                          )}
                          {!store.isActive && (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {store.city
                          ? `${store.city}${store.state ? `/${store.state}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setQrStoreId(store.id)}
                          >
                            <QrCodeIcon className="size-4" />
                            QR
                          </Button>
                          <Button
                            asChild={canOpen}
                            size="sm"
                            className="gap-2"
                            disabled={!canOpen}
                          >
                            {canOpen ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Abrir o app QR Preço da loja ${store.name}`}
                              >
                                <ExternalLink className="size-4" />
                                Abrir
                              </a>
                            ) : (
                              <span>
                                <ExternalLink className="size-4" />
                                Abrir
                              </span>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StoreQrDialog
        open={!!qrStoreId}
        onOpenChange={(open) => {
          if (!open) setQrStoreId(null);
        }}
        storeId={qrStoreId ?? ""}
        variant="scanner"
      />
    </div>
  );
}
