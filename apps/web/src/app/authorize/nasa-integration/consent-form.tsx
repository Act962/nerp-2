"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveNasaIntegration, denyNasaIntegration } from "./actions";

type Props = {
  state: string;
  redirectUri: string;
  scopes: string;
};

export function ConsentForm({ state, redirectUri, scopes }: Props) {
  const [isApproving, startApprove] = useTransition();
  const [isDenying, startDeny] = useTransition();
  const isPending = isApproving || isDenying;

  const onApprove = () => {
    startApprove(async () => {
      await approveNasaIntegration({ state, redirectUri, scopes });
    });
  };

  const onDeny = () => {
    startDeny(async () => {
      await denyNasaIntegration({ state, redirectUri });
    });
  };

  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      <Button
        onClick={onDeny}
        disabled={isPending}
        variant="outline"
        size="lg"
        className="flex-1"
      >
        {isDenying ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <X className="size-4" />
        )}
        Recusar
      </Button>
      <Button
        onClick={onApprove}
        disabled={isPending}
        size="lg"
        className="flex-1"
      >
        {isApproving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Autorizar acesso
      </Button>
    </div>
  );
}
