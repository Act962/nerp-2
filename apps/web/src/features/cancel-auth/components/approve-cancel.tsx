"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currencyFormatter } from "@/utils/currency-formatter";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import {
  useAuthorizeCancelByToken,
  useCancelRequestByToken,
  useRejectCancelRequest,
} from "../hooks/use-cancel-auth";

export function ApproveCancel({ token }: { token: string }) {
  const query = useCancelRequestByToken(token);
  const authorize = useAuthorizeCancelByToken();
  const reject = useRejectCancelRequest();

  if (query.isPending) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Carregando solicitação…
        </CardContent>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="py-10 text-center text-sm text-destructive">
          Solicitação não encontrada.
        </CardContent>
      </Card>
    );
  }

  const req = query.data;

  if (req.status !== "PENDING") {
    const done = {
      APPROVED: {
        icon: <CheckCircle2 className="size-10 text-success" />,
        text: "Cancelamento autorizado.",
      },
      REJECTED: {
        icon: <XCircle className="size-10 text-destructive" />,
        text: "Solicitação recusada.",
      },
      EXPIRED: {
        icon: <XCircle className="size-10 text-muted-foreground" />,
        text: "Solicitação expirada.",
      },
    }[req.status];
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {done.icon}
          <p className="text-sm font-medium">{done.text}</p>
        </CardContent>
      </Card>
    );
  }

  const title =
    req.kind === "REMOVE_ITEM" ? "Remover item" : "Reduzir quantidade";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-1 flex justify-center">
          <ShieldAlert className="size-9 text-primary" />
        </div>
        <CardTitle className="text-center">
          Autorizar {title.toLowerCase()}
        </CardTitle>
        <CardDescription className="text-center">
          {req.orgName} · solicitado por {req.requestedByName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="font-medium">{req.productName}</div>
          <div className="text-muted-foreground">
            {req.kind === "REMOVE_ITEM"
              ? `${req.quantity} un.`
              : `Reduzir ${req.quantity} un.`}{" "}
            · {currencyFormatter(req.amount)}
          </div>
          {req.reason && (
            <div className="mt-1 text-xs text-muted-foreground">
              Motivo: {req.reason}
            </div>
          )}
        </div>

        {req.canAuthorize ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => reject.mutate({ token })}
              disabled={reject.isPending || authorize.isPending}
            >
              Recusar
            </Button>
            <Button
              className="flex-1"
              onClick={() => authorize.mutate({ token })}
              disabled={authorize.isPending || reject.isPending}
            >
              {authorize.isPending ? "Autorizando…" : "Autorizar"}
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-destructive">
            Sua conta não tem permissão para autorizar cancelamentos nesta loja.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
