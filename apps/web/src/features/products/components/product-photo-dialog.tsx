"use client";

import { Uploader } from "@/components/file-uploader/uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Eraser, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useRemoveProductBackground,
  useSetProductThumbnail,
} from "../hooks/use-products";

/**
 * Cadastro da foto do produto direto da lista, com recorte de fundo.
 *
 * O recorte roda no SERVIDOR sobre a foto já salva (mesmo motor do
 * planograma), então a ordem é: enviar, salvar, recortar. Oferecer "remover
 * fundo" antes de salvar prometeria algo que não há como executar.
 */
export function ProductPhotoDialog({
  produto,
  onOpenChange,
}: {
  produto: { id: string; name: string; image: string } | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const [chave, setChave] = useState<string>("");
  const salvar = useSetProductThumbnail();
  const recortar = useRemoveProductBackground();

  // O último produto aberto continua desenhado enquanto o diálogo fecha. Sem
  // isto, `produto` virando `null` desmontava o `Dialog` INTEIRO de uma vez —
  // portal, trava de rolagem e guardas de foco do Radix — em vez de deixar o
  // Radix conduzir o fechamento pelo `open`.
  const [ultimo, setUltimo] = useState(produto);

  // Cada produto abre com a própria foto; sem isto o diálogo herdaria a chave
  // do item anterior.
  useEffect(() => {
    if (!produto) return;
    setUltimo(produto);
    setChave(produto.image || "");
  }, [produto]);

  if (!ultimo) return null;

  const temFotoSalva = Boolean(ultimo.image);
  const mudouAFoto = chave !== "" && chave !== ultimo.image;
  const suspeita =
    recortar.data && !recortar.data.applied ? recortar.data.reason : null;

  return (
    <Dialog open={produto !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{ultimo.name}</DialogTitle>
          <DialogDescription>
            Envie a foto e, depois de salvar, recorte o fundo.
          </DialogDescription>
        </DialogHeader>

        <Uploader value={chave} onChange={(v) => setChave(v ?? "")} />

        {temFotoSalva && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => recortar.mutate({ productId: ultimo.id })}
              disabled={recortar.isPending || mudouAFoto}
            >
              {recortar.isPending ? <Spinner /> : <Eraser className="size-4" />}
              Remover fundo
            </Button>
            {mudouAFoto && (
              <p className="text-xs text-muted-foreground">
                Salve a foto nova antes de recortar — o recorte roda sobre a
                imagem já gravada.
              </p>
            )}
            {suspeita && (
              // O motor devolve o motivo quando não confia no recorte. Mostrar
              // é o que permite ao usuário decidir refotografar em fundo liso.
              <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <span>
                  Foto preservada: {suspeita}. Refotografe em fundo liso e
                  uniforme para o recorte funcionar.
                </span>
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() =>
              salvar.mutate(
                { productId: ultimo.id, key: chave },
                { onSuccess: () => onOpenChange(false) },
              )
            }
            disabled={!chave || salvar.isPending || chave === ultimo.image}
          >
            {salvar.isPending && <Spinner />}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
