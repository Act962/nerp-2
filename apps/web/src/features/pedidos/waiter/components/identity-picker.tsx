"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { UsersIcon } from "lucide-react";
import {
  useWaiterCollaborators,
} from "../hooks/use-waiter-pedidos";
import type { WaiterIdentity } from "../hooks/use-waiter-session";

interface Props {
  orgSlug: string;
  onPick: (identity: WaiterIdentity) => void;
}

export function IdentityPicker({ orgSlug, onPick }: Props) {
  const { data, isLoading } = useWaiterCollaborators(orgSlug);

  return (
    <div className="flex flex-1 flex-col px-5 pt-8 pb-12">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Quem está atendendo?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toque no seu nome para abrir o app.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Nenhum colaborador cadastrado</EmptyTitle>
            <EmptyDescription>
              Peça ao gerente para cadastrar os colaboradores em /colaboradores.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onPick({
                  collaboratorId: c.id,
                  name: c.name,
                  photoUrl: c.photoUrl,
                  role: c.role,
                })
              }
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm transition active:scale-[0.98] hover:bg-accent"
            >
              <Avatar className="size-16">
                {c.photoUrl && (
                  <AvatarImage src={constructUrl(c.photoUrl)} alt={c.name} />
                )}
                <AvatarFallback className="text-xl">
                  {c.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold leading-tight">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
