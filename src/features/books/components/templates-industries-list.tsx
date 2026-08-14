"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  CheckCircle2,
  ChevronRight,
  Factory,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTemplateIndustries } from "../hooks/use-books";

// Tela-lista de /padroes: uma linha por indústria com status de completude.
// Escala pra 100+ indústrias — busca no topo, botão "Novo padrão" (escolhe
// indústria + tipo), e o detalhe (as seções de padrões) fica em
// /padroes/industria/[id].
export function TemplatesIndustriesList() {
  const { industries, isLoading } = useTemplateIndustries();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return industries;
    return industries.filter((i) => i.name.toLowerCase().includes(q));
  }, [industries, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar indústria…"
            className="pl-9"
          />
        </div>
        <NewTemplateDialog
          industries={industries.map((i) => ({ id: i.id, name: i.name }))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma indústria encontrada.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((ind) => (
            <Link
              key={ind.id}
              href={`/padroes/industria/${ind.id}`}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {ind.logo ? (
                  // biome-ignore lint/performance/noImgElement: thumbnail do R2
                  <img
                    src={constructUrl(ind.logo)}
                    alt=""
                    className="size-full object-contain"
                  />
                ) : (
                  <Factory className="size-5 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ind.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span>{ind.hasCover ? "Capa ✓" : "Capa —"}</span>
                  <span>·</span>
                  <span>{ind.photoCount} foto(s)</span>
                  <span>·</span>
                  <span>{ind.hasClosing ? "Final ✓" : "Final —"}</span>
                  {ind.extraCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{ind.extraCount} extra(s)</span>
                    </>
                  )}
                </div>
              </div>

              {ind.isComplete ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3" />
                  Completo
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <TriangleAlert className="size-3" />
                  Falta {ind.missing.join(", ")}
                </Badge>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// "Novo padrão" a partir da lista: escolhe a indústria e vai pra página dela,
// onde a capa, páginas de fotos, extras e final são criadas por seção (cada
// uma com seu placeholder "Criar"). O tipo é escolhido lá, visualmente.
function NewTemplateDialog({
  industries,
}: {
  industries: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");

  const submit = () => {
    if (!supplierId) return;
    setOpen(false);
    router.push(`/padroes/industria/${supplierId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Novo padrão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo padrão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Para qual indústria?</FieldLabel>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a indústria" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="text-sm text-muted-foreground">
            Você vai escolher o tipo (capa, página de fotos, extra ou final) na
            página da indústria.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!supplierId}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
