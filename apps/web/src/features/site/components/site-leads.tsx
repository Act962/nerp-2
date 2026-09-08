"use client";

import { findCatalogTool } from "@nerp/site-content";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SiteLeadStatus } from "@/generated/prisma/enums";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import {
  useDeleteSiteLead,
  useSiteLead,
  useSiteLeads,
  useUpdateSiteLead,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

/**
 * Os interessados que o Astro qualificou no site.
 *
 * O que se lê aqui é o DIAGNÓSTICO, não a conversa: a transcrição não é
 * guardada de propósito — o que serve ao comercial é a dor, o porte, as
 * ferramentas e a faixa que foi dita. "Copiar briefing" põe isso no formato de
 * colar no Forge.
 */

const STATUS: Array<{ id: SiteLeadStatus; label: string }> = [
  { id: "NOVO", label: "Novos" },
  { id: "EM_CONTATO", label: "Em contato" },
  { id: "QUALIFICADO", label: "Qualificados" },
  { id: "GANHO", label: "Ganhos" },
  { id: "PERDIDO", label: "Perdidos" },
  { id: "ARQUIVADO", label: "Arquivados" },
];

function formatarFaixa(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null;
  const reais = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    })
      .format(cents / 100)
      .replace(/[  ]/g, " ");
  return min === max ? reais(min) : `${reais(min)} a ${reais(max)}`;
}

function nomesDeFerramentas(ids: string[]): string {
  if (ids.length === 0) return "—";
  return ids.map((id) => findCatalogTool(id)?.name ?? id).join(", ");
}

export function SiteLeads() {
  const [status, setStatus] = useState<SiteLeadStatus | undefined>();
  const [aberto, setAberto] = useState<string | null>(null);
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  const { leads, nextCursor, novos, isLoading } = useSiteLeads({
    status,
    cursor,
  });

  return (
    <>
      <SitePageHeader
        title="Leads do Astro"
        description="Quem conversou com o consultor no site e deixou contato. O diagnóstico fica aqui; a conversa não é guardada."
        actions={
          novos > 0 ? (
            <Badge variant="secondary">{novos} novo(s)</Badge>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={status === undefined ? "default" : "outline"}
          onClick={() => {
            setStatus(undefined);
            reset();
          }}
        >
          Todos
        </Button>
        {STATUS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={status === item.id ? "default" : "outline"}
            onClick={() => {
              setStatus(item.id);
              reset();
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 p-0 pb-2">
          {isLoading && <Skeleton className="mx-4 my-4 h-24" />}

          {!isLoading && leads.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum lead ainda. Eles aparecem aqui quando alguém fecha um
              diagnóstico com o Astro no site.
            </p>
          )}

          {leads.map((lead) => (
            <button
              type="button"
              key={lead.id}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
              onClick={() => setAberto(aberto === lead.id ? null : lead.id)}
            >
              <div className="min-w-48 flex-1">
                <span className="block text-sm font-medium">
                  {lead.name}
                  {lead.company ? ` · ${lead.company}` : ""}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {lead.email ?? lead.phone ?? "sem contato"} ·{" "}
                  {nomesDeFerramentas(lead.toolIds)}
                </span>
              </div>

              {formatarFaixa(lead.quotedMinCents, lead.quotedMaxCents) && (
                <span className="text-xs text-muted-foreground">
                  {formatarFaixa(lead.quotedMinCents, lead.quotedMaxCents)}
                </span>
              )}

              <Badge variant={lead.status === "NOVO" ? "default" : "secondary"}>
                {STATUS.find((s) => s.id === lead.status)?.label ?? lead.status}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      {(hasPrevious || nextCursor) && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrevious}
            disabled={!hasPrevious}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pageIndex}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goNext(nextCursor)}
            disabled={!nextCursor}
          >
            Próxima
          </Button>
        </div>
      )}

      {aberto && <DetalheDoLead id={aberto} onFechar={() => setAberto(null)} />}
    </>
  );
}

function DetalheDoLead({ id, onFechar }: { id: string; onFechar: () => void }) {
  const { lead, isLoading } = useSiteLead(id);
  const atualizar = useUpdateSiteLead();
  const excluir = useDeleteSiteLead();
  const [notas, setNotas] = useState<string | null>(null);

  if (isLoading || !lead) {
    return <Skeleton className="mt-6 h-64" />;
  }

  const briefing = (lead.briefing ?? {}) as {
    dorPrincipal?: string;
    resumo?: string;
    faixa?: string | null;
    memoriaDeCalculo?: string[];
  };

  const textoDoBriefing = [
    `Cliente: ${lead.name}${lead.company ? ` — ${lead.company}` : ""}`,
    `Contato: ${[lead.email, lead.phone].filter(Boolean).join(" · ") || "—"}`,
    `Segmento: ${lead.segment ?? "—"}`,
    `Operação: ${lead.stores ?? "?"} loja(s), ${lead.users ?? "?"} usuário(s)`,
    `Ferramentas: ${nomesDeFerramentas(lead.toolIds)}`,
    `Faixa apresentada: ${briefing.faixa ?? "nenhuma"}`,
    "",
    `Dor: ${briefing.dorPrincipal ?? "—"}`,
    "",
    briefing.resumo ?? "",
  ].join("\n");

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {lead.name}
            {lead.company ? ` · ${lead.company}` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {[lead.email, lead.phone].filter(Boolean).join(" · ") ||
              "sem contato"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(textoDoBriefing);
              toast.success("Briefing copiado");
            }}
          >
            <Copy className="size-4" /> Copiar briefing
          </Button>
          <Button variant="ghost" size="sm" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Segmento: </span>
            {lead.segment ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Operação: </span>
            {lead.stores ?? "?"} loja(s), {lead.users ?? "?"} usuário(s)
          </p>
          <p>
            <span className="text-muted-foreground">Ferramentas: </span>
            {nomesDeFerramentas(lead.toolIds)}
          </p>
          <p>
            <span className="text-muted-foreground">Faixa apresentada: </span>
            {briefing.faixa ?? "nenhuma"}
          </p>
        </div>

        {briefing.dorPrincipal && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dor
            </p>
            <p className="text-sm">{briefing.dorPrincipal}</p>
          </div>
        )}

        {briefing.resumo && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo do Astro
            </p>
            <p className="text-sm">{briefing.resumo}</p>
          </div>
        )}

        {briefing.memoriaDeCalculo && briefing.memoriaDeCalculo.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Como a faixa foi montada
            </p>
            <ul className="text-xs text-muted-foreground">
              {briefing.memoriaDeCalculo.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="notas">Anotações do time</FieldLabel>
          <Textarea
            id="notas"
            rows={3}
            value={notas ?? lead.notes ?? ""}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() =>
              notas !== null &&
              notas !== (lead.notes ?? "") &&
              atualizar.mutate({ id: lead.id, notes: notas })
            }
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={lead.status === item.id ? "default" : "outline"}
              onClick={() => atualizar.mutate({ id: lead.id, status: item.id })}
            >
              {item.label}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            onClick={() => {
              if (
                confirm(
                  "Excluir este lead e as conversas dele? Não dá para desfazer.",
                )
              ) {
                excluir.mutate({ id: lead.id });
                onFechar();
              }
            }}
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
        </div>

        {lead.conversas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {lead.conversas.length} conversa(s) ·{" "}
            {lead.conversas.reduce((s, c) => s + c.messageCount, 0)}{" "}
            mensagem(ns) ·{" "}
            {lead.conversas.reduce((s, c) => s + c.tokensIn + c.tokensOut, 0)}{" "}
            tokens
            {lead.conversas[0]?.utmSource
              ? ` · veio de ${lead.conversas[0].utmSource}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
