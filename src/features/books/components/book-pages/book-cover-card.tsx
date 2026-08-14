"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTemplateForBook } from "../../hooks/use-books";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  DEFAULT_COVER_BACKGROUND,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import {
  isBackground,
  isElementArray,
  LayoutPreview,
  type LayoutLogos,
} from "../templates/layout-preview";

// Editor Konva completo — pesado, só entra no bundle quando o usuário clica
// em "Editar". Reusa o CoverEditor que já sabe sub-tabs Capa/Página Final.
const CoverEditor = dynamic(
  () => import("../cover-editor/cover-editor").then((m) => m.CoverEditor),
  { ssr: false },
);

interface BookCoverCardProps {
  bookId: string;
  bookName: string;
  supplierId: string | null;
  supplierName: string | null;
  organizationName: string;
  periodMonth: number;
  periodYear: number;
  coverLayout: unknown;
  closingLayout: unknown;
  coverBackground: unknown;
  closingBackground: unknown;
  logos: LayoutLogos;
  variableValues: BookVariableValues;
  kind: "cover" | "closing";
  position: number;
  total: number;
}

// Card que mostra a capa OU a página final do book na sequência do scroll.
// A cascata book → template do supplier → template da org → default é a
// mesma do CoverEditor e do generate-book, mantida aqui pra o preview
// nunca aparecer em branco.
export function BookCoverCard(props: BookCoverCardProps) {
  const { template, isLoading } = useTemplateForBook(props.supplierId);
  const [editing, setEditing] = useState(false);

  const isCover = props.kind === "cover";
  const bookLayout = isCover ? props.coverLayout : props.closingLayout;
  const bookBackground = isCover
    ? props.coverBackground
    : props.closingBackground;
  const templateLayout = isCover
    ? template?.coverLayout
    : template?.closingLayout;
  const templateBackground = isCover
    ? template?.coverBackground
    : template?.closingBackground;

  // Cascata visual: prioriza layout salvo no book, depois o do template,
  // depois o built-in que já traz logo org + logo indústria + {{nomeBook}}.
  const layout: CoverElement[] = isElementArray(bookLayout)
    ? bookLayout
    : isElementArray(templateLayout)
      ? templateLayout
      : isCover
        ? buildDefaultCoverLayout()
        : buildDefaultClosingLayout();

  const background: CoverBackground = isBackground(bookBackground)
    ? bookBackground
    : isBackground(templateBackground)
      ? templateBackground
      : DEFAULT_COVER_BACKGROUND;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">
            Página {props.position}/{props.total}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">
            {isCover ? "Capa" : "Página final"}
          </span>
          <Badge variant="outline">{isCover ? "capa" : "final"}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={isLoading}
        >
          <Pencil className="size-4" />
          Editar
        </Button>
      </div>

      <div className="bg-muted/10 p-4">
        <LayoutPreview
          layout={layout}
          background={background}
          logos={props.logos}
          variableValues={props.variableValues}
        />
      </div>

      {editing && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                Editar {isCover ? "capa" : "página final"} — {props.bookName}
              </DialogTitle>
            </DialogHeader>
            <CoverEditor
              bookId={props.bookId}
              bookName={props.bookName}
              supplierId={props.supplierId}
              supplierName={props.supplierName}
              organizationName={props.organizationName}
              periodMonth={props.periodMonth}
              periodYear={props.periodYear}
              logos={props.logos}
              coverLayout={props.coverLayout}
              closingLayout={props.closingLayout}
              coverBackground={props.coverBackground}
              closingBackground={props.closingBackground}
              onRequestSaveTemplate={() => {}}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
