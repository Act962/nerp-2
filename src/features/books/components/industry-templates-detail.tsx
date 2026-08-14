"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildSampleValues } from "../lib/book-variables";
import {
  useCreateIndustryBase,
  useCreateIndustryTemplate,
  useDeleteBookPageTemplate,
  useIndustryTemplates,
  useReapplyIndustryBase,
} from "../hooks/use-books";
import { LayoutPreview } from "./templates/layout-preview";

// Valores de exemplo pra o preview do card resolver {{nomeBook}}, {{periodo}},
// {{loja}} etc. — sem isso os tokens somem (viram string vazia) e a capa
// aparece sem título/período.
const PREVIEW_VALUES = buildSampleValues();

type TemplateKind = "COVER" | "PHOTO" | "EXTRA" | "CLOSING";
type Orientation = "LANDSCAPE" | "PORTRAIT";

// Detalhe de uma indústria: seções Capa, Fotos horizontais (1-2), Fotos
// verticais (1-4), Extras, Página final. Cada peça mostra miniatura + Editar,
// ou um placeholder "Criar". Criar → cria o padrão semeado e abre o editor.
export function IndustryTemplatesDetail({
  supplierId,
}: {
  supplierId: string;
}) {
  const { data, isLoading } = useIndustryTemplates(supplierId);
  const create = useCreateIndustryTemplate();
  const createBase = useCreateIndustryBase();
  const reapplyBase = useReapplyIndustryBase();
  const router = useRouter();

  const openBase = () => {
    createBase.mutate(
      { supplierId },
      { onSuccess: (r) => router.push(`/padroes/${r.id}`) },
    );
  };

  const openCreate = (
    kind: TemplateKind,
    opts?: { photoOrientation?: Orientation; photoSize?: number },
  ) => {
    create.mutate(
      {
        supplierId,
        kind,
        photoOrientation: opts?.photoOrientation,
        photoSize: opts?.photoSize,
      },
      { onSuccess: (r) => router.push(`/padroes/${r.id}`) },
    );
  };

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/padroes" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{data.supplier.name}</h1>
            <p className="text-sm text-muted-foreground">
              Padrões de página desta indústria
            </p>
          </div>
        </div>
        {data.isComplete ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="size-3" />
            Pronta para gerar books
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-amber-600">
            <TriangleAlert className="size-3" />
            Falta: {data.missing.join(", ")}
          </Badge>
        )}
      </div>

      <Section
        title="Padrão base"
        hint="Configure aqui o fundo, os logos e o nome da loja uma vez. Ao criar as páginas de fotos abaixo, elas já nascem com esse visual — é só posicionar as fotos."
        action={
          data.base ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => reapplyBase.mutate({ supplierId })}
              disabled={reapplyBase.isPending}
            >
              {reapplyBase.isPending ? (
                <Spinner className="size-3" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Reaplicar às páginas de fotos
            </Button>
          ) : undefined
        }
      >
        <SlotCard
          template={data.base}
          onCreate={openBase}
          isCreating={createBase.isPending}
          label="Padrão base"
        />
        {data.base && (
          <p className="text-xs text-muted-foreground">
            Editou o padrão base? Clique em “Reaplicar às páginas de fotos” para
            atualizar o fundo e os logos das páginas já criadas — o arranjo das
            fotos de cada página é preservado.
          </p>
        )}
      </Section>

      <Section title="Capa" required>
        <SlotCard
          template={data.cover}
          onCreate={() => openCreate("COVER")}
          isCreating={create.isPending}
          label="Capa"
        />
      </Section>

      <Section title="Fotos horizontais" required>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.landscapeSlots.map((slot) => (
            <SlotCard
              key={`L${slot.size}`}
              template={slot.template}
              onCreate={() =>
                openCreate("PHOTO", {
                  photoOrientation: "LANDSCAPE",
                  photoSize: slot.size,
                })
              }
              isCreating={create.isPending}
              label={`${slot.size} foto${slot.size > 1 ? "s" : ""} horizontal${slot.size > 1 ? "is" : ""}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Fotos verticais" required>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.portraitSlots.map((slot) => (
            <SlotCard
              key={`P${slot.size}`}
              template={slot.template}
              onCreate={() =>
                openCreate("PHOTO", {
                  photoOrientation: "PORTRAIT",
                  photoSize: slot.size,
                })
              }
              isCreating={create.isPending}
              label={`${slot.size} foto${slot.size > 1 ? "s" : ""} vertical${slot.size > 1 ? "is" : ""}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Páginas extras (opcional)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.extras.map((t) => (
            <SlotCard
              key={t.id}
              template={t}
              onCreate={() => {}}
              isCreating={false}
              label="Extra"
            />
          ))}
          <button
            type="button"
            onClick={() => openCreate("EXTRA")}
            disabled={create.isPending}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <Plus className="size-5" />
            Adicionar extra
          </button>
        </div>
      </Section>

      <Section title="Página final" required>
        <SlotCard
          template={data.closing}
          onCreate={() => openCreate("CLOSING")}
          isCreating={create.isPending}
          label="Página final"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  required,
  hint,
  action,
  children,
}: {
  title: string;
  required?: boolean;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {required && (
            <Badge variant="outline" className="text-xs">
              obrigatório
            </Badge>
          )}
        </div>
        {action}
      </div>
      {hint && (
        <p className="max-w-3xl text-sm text-muted-foreground">{hint}</p>
      )}
      {children}
    </section>
  );
}

interface TemplateData {
  id: string;
  name: string;
  layout: unknown;
  background: unknown;
}

function SlotCard({
  template,
  onCreate,
  isCreating,
  label,
}: {
  template: TemplateData | null;
  onCreate: () => void;
  isCreating: boolean;
  label: string;
}) {
  const del = useDeleteBookPageTemplate();

  if (!template) {
    return (
      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/40"
      >
        {isCreating ? <Spinner /> : <Plus className="size-5" />}
        Criar {label}
      </button>
    );
  }

  return (
    <Card className="group overflow-hidden">
      <Link href={`/padroes/${template.id}`} className="block">
        <div className="relative border-b bg-muted/30 p-2">
          <LayoutPreview
            layout={template.layout}
            background={template.background}
            variableValues={PREVIEW_VALUES}
          />
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900">
              <Pencil className="size-3" />
              Editar
            </span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 p-2">
        <span className="truncate text-sm font-medium">{template.name}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => del.mutate({ id: template.id })}
          disabled={del.isPending}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          <span className="sr-only">Excluir</span>✕
        </Button>
      </div>
    </Card>
  );
}
