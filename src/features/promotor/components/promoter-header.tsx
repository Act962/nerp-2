"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { constructUrl } from "@/hooks/use-construct-url";
import { formatWhatsapp } from "@/lib/whatsapp";
import {
  CalendarDays,
  Factory,
  Images,
  Menu,
  Phone,
  Store as StoreIcon,
  UserRound,
  X,
} from "lucide-react";

export type PromotorView =
  | "capture"
  | "route"
  | "photos"
  | "industries"
  | "clients";

export function PromoterHeader({
  name,
  image,
  whatsapp,
  orgName,
  orgLogo,
  rejectedCount = 0,
  onOpenCalendar,
  onOpenRejected,
  onNavigate,
  onEditPhoto,
  onEditWhatsapp,
}: {
  name: string;
  image: string | null;
  whatsapp: string | null;
  orgName: string;
  orgLogo: string | null;
  /** Fotos reprovadas — vira a bolinha vermelha sobre o menu. */
  rejectedCount?: number;
  onOpenCalendar: () => void;
  onNavigate: (view: PromotorView) => void;
  onOpenRejected: () => void;
  onEditPhoto: () => void;
  onEditWhatsapp: () => void;
}) {
  const initials = name.trim().slice(0, 1).toUpperCase() || "P";

  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center">
        <div className="size-12 shrink-0 overflow-hidden rounded-full border bg-muted">
          {image ? (
            // biome-ignore lint/performance/noImgElement: avatar de URL do R2
            <img src={image} alt={name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
              {initials}
            </div>
          )}
        </div>

        {/* Logo da org menor e sobreposta ao avatar (`-ml-3`): assina de quem é
          o promotor sem virar um segundo bloco disputando espaço no topo. O
          `ring` da cor do fundo recorta a sobreposição. */}
        <div className="-ml-3 size-8 shrink-0 overflow-hidden rounded-full bg-background ring-2 ring-background">
          {orgLogo ? (
            // biome-ignore lint/performance/noImgElement: logo de chave do R2
            <img
              src={constructUrl(orgLogo)}
              alt={orgName}
              className="size-full object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground">
              {orgName.trim().slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="ml-2 min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{orgName}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Abrir calendário"
          onClick={onOpenCalendar}
        >
          <CalendarDays className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-11 shrink-0"
              aria-label={
                rejectedCount > 0
                  ? `Abrir menu — ${rejectedCount} foto(s) reprovada(s)`
                  : "Abrir menu"
              }
            >
              <Menu className="size-5" />
              {/* Reprovada é trabalho a refazer e o promotor pode nem voltar à
              aba de fotos. A bolinha aparece na primeira tela, sempre. */}
              {rejectedCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                  {rejectedCount > 99 ? "99+" : rejectedCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {whatsapp ? formatWhatsapp(whatsapp) : "Sem WhatsApp"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {rejectedCount > 0 && (
              <DropdownMenuItem
                onSelect={onOpenRejected}
                className="text-red-600 focus:text-red-600"
              >
                <X className="size-4" /> Fotos reprovadas
                <span className="ml-auto rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                  {rejectedCount}
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEditPhoto}>
              <UserRound className="size-4" /> Editar foto de perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEditWhatsapp}>
              <Phone className="size-4" /> Editar WhatsApp
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onNavigate("industries")}>
              <Factory className="size-4" /> Minhas indústrias
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNavigate("clients")}>
              <StoreIcon className="size-4" /> Meus clientes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNavigate("photos")}>
              <Images className="size-4" /> Minhas fotos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
