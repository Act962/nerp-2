"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  useAddBookExtraPage,
  useIndustryTemplates,
} from "../../hooks/use-books";

// Posição escolhida no select. "end"/"start" são tokens; qualquer outro valor
// é o id da página após a qual inserir. (Cuids nunca colidem com esses tokens.)
const AT_END = "end";
const AT_START = "start";

export interface ExtraPagePosition {
  id: string;
  label: string;
}

// Botão do editor de book para inserir uma PÁGINA EXTRA (abertura, divisória,
// encerramento) a partir dos padrões kind=EXTRA da indústria. Abre um diálogo
// pra escolher o modelo E a posição — num book grande, mandar sempre pro fim e
// reordenar com as setas seria inviável.
export function AddExtraPageButton({
  bookId,
  supplierId,
  pages,
}: {
  bookId: string;
  supplierId: string | null;
  pages: ExtraPagePosition[];
}) {
  const { data } = useIndustryTemplates(supplierId ?? "");
  const add = useAddBookExtraPage();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [position, setPosition] = useState<string>(AT_END);

  // Book sem indústria não tem padrões de página extra pra oferecer.
  if (!supplierId) return null;

  const extras = data?.extras ?? [];

  if (extras.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma página extra cadastrada.{" "}
        <Link
          href={`/padroes/industria/${supplierId}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Criar em Padrões
        </Link>
      </p>
    );
  }

  const submit = () => {
    if (!templateId) return;
    // Token → afterPageId: fim = undefined, início = null, senão o id da página.
    const afterPageId =
      position === AT_END ? undefined : position === AT_START ? null : position;
    add.mutate(
      { bookId, templateId, afterPageId },
      {
        onSuccess: () => {
          setOpen(false);
          setTemplateId("");
          setPosition(AT_END);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" />
          Adicionar página extra
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar página extra</DialogTitle>
          <DialogDescription>
            Escolha o modelo e onde a página entra no book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Modelo</FieldLabel>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o padrão extra" />
              </SelectTrigger>
              <SelectContent>
                {extras.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Posição</FieldLabel>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={AT_END}>No fim</SelectItem>
                <SelectItem value={AT_START}>No início</SelectItem>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Depois de: {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={add.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!templateId || add.isPending}
          >
            Adicionar página
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
