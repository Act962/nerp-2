"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/lib/orpc";
import { useCreateCatalogByCategories } from "../hooks/use-catalog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogos: { id: string; name: string }[];
};

// A capa e o estilo saem de um catálogo que já existe; cada categoria marcada
// vira as suas páginas. Da lista ao catálogo pronto: abrir, escolher o modelo,
// "Todas", Criar.
export function CreateByCategoriesDialog({
  open,
  onOpenChange,
  catalogos,
}: Props) {
  const [nome, setNome] = useState("Todas as categorias");
  const [moldeId, setMoldeId] = useState<string>("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const criar = useCreateCatalogByCategories();

  const resumo = useQuery(
    orpc.promotionalCatalog.categorySummary.queryOptions({
      input: { excludeIds: [], filters: { onlyActive: true } },
      enabled: open,
    }),
  );
  // "Sem categoria" não vira página: não há nome nem vínculo para ela.
  const categorias = useMemo(
    () =>
      (resumo.data ?? []).filter(
        (c): c is typeof c & { id: string } => !!c.id && c.total > 0,
      ),
    [resumo.data],
  );

  const escolhidas = categorias.filter((c) => marcadas.includes(c.id));
  const semPreco = escolhidas.reduce((s, c) => s + c.semPreco, 0);
  const semFoto = escolhidas.reduce((s, c) => s + c.semFoto, 0);
  const todas =
    categorias.length > 0 && escolhidas.length === categorias.length;

  const alternar = (id: string) =>
    setMarcadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const enviar = () => {
    if (!nome.trim() || !moldeId || escolhidas.length === 0) return;
    criar.mutate(
      {
        name: nome.trim(),
        moldeId,
        // Na ordem da lista, que é a ordem das páginas.
        categoryIds: escolhidas.map((c) => c.id),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar por categorias</DialogTitle>
          <DialogDescription>
            A capa e o estilo vêm do catálogo de modelo; cada categoria ganha as
            suas páginas, com o nome dela no título.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="por-categorias-nome">Nome do catálogo</Label>
          <Input
            id="por-categorias-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Catálogo de modelo</Label>
          <Select value={moldeId} onValueChange={setMoldeId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha o catálogo que dá o visual" />
            </SelectTrigger>
            <SelectContent>
              {catalogos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Categorias</Label>
            <Button
              variant="ghost"
              size="sm"
              disabled={categorias.length === 0}
              onClick={() =>
                setMarcadas(todas ? [] : categorias.map((c) => c.id))
              }
            >
              {todas ? "Limpar" : "Todas"}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            {resumo.isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : categorias.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma categoria com produtos ativos.
              </p>
            ) : (
              categorias.map((c) => (
                <label
                  key={c.id}
                  htmlFor={`por-categorias-${c.id}`}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`por-categorias-${c.id}`}
                    checked={marcadas.includes(c.id)}
                    onCheckedChange={() => alternar(c.id)}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.semPreco > 0 && (
                    <Badge variant="outline" className="text-amber-600">
                      {c.semPreco} sem preço
                    </Badge>
                  )}
                  {c.semFoto > 0 && (
                    <Badge variant="outline" className="text-amber-600">
                      <ImageOff className="size-3" />
                      {c.semFoto}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.total}
                  </span>
                </label>
              ))
            )}
          </div>
          {(semPreco > 0 || semFoto > 0) && (
            <p className="text-xs text-amber-600">
              Entram {semPreco > 0 && `${semPreco} produto(s) com preço 0`}
              {semPreco > 0 && semFoto > 0 && " e "}
              {semFoto > 0 && `${semFoto} sem foto`}. Dá para ajustar depois no
              editor.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={
              !nome.trim() ||
              !moldeId ||
              escolhidas.length === 0 ||
              criar.isPending
            }
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar {escolhidas.length > 0 && `(${escolhidas.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
