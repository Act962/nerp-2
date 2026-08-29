"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { hasFullAccess } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { QrCode, ShieldAlert, Smartphone } from "lucide-react";
import { useState } from "react";
import {
  useCreateScannerPairing,
  useRevokeScannerPairing,
  useScannerStatus,
} from "../hooks/use-scanner";
import { ScannerQrCard } from "./scanner-qr-card";

export function ScannerPage() {
  const { data: member, isPending } = useQuery(
    orpc.members.getCurrent.queryOptions({ input: {} }),
  );
  const [token, setToken] = useState<string | null>(null);
  const create = useCreateScannerPairing();
  const revoke = useRevokeScannerPairing();
  const { data: status } = useScannerStatus(token);

  if (isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner />
      </div>
    );
  }

  // O servidor recusa de novo em `createPairing` — esta tela só evita oferecer
  // um botão que não funcionaria.
  if (!hasFullAccess(member?.role)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="font-medium">Só o dono ou um administrador</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            O código dispensa senha, então quem pode transformar um celular em
            leitor é quem administra a organização.
          </p>
        </CardContent>
      </Card>
    );
  }

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/leitor/${token}`
      : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <Card className="lg:w-[420px]">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {token && url ? (
            <>
              <ScannerQrCard value={url} />
              {status?.status === "ACTIVE" ? (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Smartphone className="size-4" />
                  Celular conectado e lendo
                </p>
              ) : status?.status === "EXPIRED" ? (
                <p className="text-sm text-muted-foreground">
                  Código expirado — gere outro.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aguardando o celular abrir...
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    create.mutate(
                      {},
                      { onSuccess: ({ token: novo }) => setToken(novo) },
                    )
                  }
                >
                  Gerar outro
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    revoke.mutate(
                      { token },
                      { onSuccess: () => setToken(null) },
                    )
                  }
                >
                  Encerrar
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="lg"
              onClick={() =>
                create.mutate(
                  {},
                  { onSuccess: ({ token: novo }) => setToken(novo) },
                )
              }
              disabled={create.isPending}
            >
              {create.isPending ? <Spinner /> : <QrCode className="size-5" />}
              Gerar código de pareamento
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex-1 space-y-4 text-sm text-muted-foreground">
        <div>
          <h3 className="font-medium text-foreground">Como funciona</h3>
          <p className="mt-1">
            Gere o código, aponte a câmera do celular e ele vira um leitor deste
            terminal. O que for lido entra na venda aberta no PDV, pelo mesmo
            caminho do leitor de balcão — promoção, estoque e produto pesável
            valem igual.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">Por que o prazo curto</h3>
          <p className="mt-1">
            O código dispensa senha, que é o que o torna usável no balcão. Em
            troca ele vale por poucos minutos e pareia um aparelho só — foto da
            tela não serve depois que expira.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">Limite</h3>
          <p className="mt-1">
            É um leitor de conveniência, para conferência e reposição. Para o
            volume do caixa, o leitor de balcão continua sendo mais rápido.
          </p>
        </div>
      </div>
    </div>
  );
}
