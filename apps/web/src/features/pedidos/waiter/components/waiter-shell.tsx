"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { constructUrl } from "@/hooks/use-construct-url";
import { LogOut } from "lucide-react";
import type { WaiterIdentity } from "../hooks/use-waiter-session";

interface Props {
  orgName: string;
  identity: WaiterIdentity;
  onSwitchIdentity: () => void;
}

export function WaiterShell({ orgName, identity, onSwitchIdentity }: Props) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10">
          {identity.photoUrl && (
            <AvatarImage
              src={constructUrl(identity.photoUrl)}
              alt={identity.name}
            />
          )}
          <AvatarFallback>
            {identity.name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {identity.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {identity.role} · {orgName}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onSwitchIdentity}
        aria-label="Trocar atendente"
      >
        <LogOut className="size-4" />
      </Button>
    </header>
  );
}
