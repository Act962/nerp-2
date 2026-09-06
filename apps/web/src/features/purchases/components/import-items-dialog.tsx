"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { FileSpreadsheet, TriangleAlert, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  autoMapear,
  CAMPOS_ITEM,
  type CampoItem,
  type LinhaPlanilha,
  type MapeamentoItem,
  MAX_LINHAS,
  resolverLinhas,
} from "../lib/import-items";
import type { PickedProduct } from "./item-search";

const NENHUMA = "__nenhuma__";
const TAMANHO_MAX = 5 * 1024 * 1024;

export interface ItemImportado {
  product: PickedProduct;
  quantity: number;
  unitPrice: number;
  discount: number;
  newSalePrice: number | null;
}

/**
 * Importa os ITENS de uma nota a partir de uma planilha.
 *
 * A planilha é a lista de itens de UMA entrada — ela preenche a nota aberta,
 * não cria notas. E não processa nada: os itens entram na tela para o operador
 * conferir e decidir entre salvar rascunho e processar, mantendo `process.ts`
 * como o único lugar que mexe em estoque, custo e contas a pagar.
 *
 * O arquivo é lido no NAVEGADOR e nunca sobe para lugar nenhum: sem upload, sem
 * S3, sem job. O que o servidor recebe é só a lista de códigos, para resolver
 * quais produtos existem.
 */
export function ImportItemsDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onImport: (itens: ItemImportado[]) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapa, setMapa] = useState<MapeamentoItem>({});
  const [produtos, setProdutos] = useState<Map<string, PickedProduct>>(
    new Map(),
  );
  const [lendo, setLendo] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState("");

  const limpar = () => {
    setLinhas([]);
    setColunas([]);
    setMapa({});
    setProdutos(new Map());
    setNomeArquivo("");
  };

  const receber = async (file: File) => {
    setLendo(true);
    try {
      // CSV entra como TEXTO, não como bytes. Lido de um ArrayBuffer, o
      // SheetJS decodifica CSV como latin1 e "Código de Barras" vira
      // "CÃ³digo de Barras" — o nome da coluna aparece corrompido na tela e o
      // mapeamento automático não reconhece mais nada com acento. `file.text()`
      // decodifica UTF-8, que é o que o Excel e o Sheets exportam.
      // XLSX é um zip com as strings já em UTF-8 por dentro, e segue por bytes.
      const ehCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      const workbook = ehCsv
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json<LinhaPlanilha>(sheet, {
        defval: "",
        raw: false,
      });
      if (dados.length === 0) {
        toast.error("A planilha não tem nenhuma linha de dados");
        return;
      }
      if (dados.length > MAX_LINHAS) {
        toast.error(
          `A planilha tem ${dados.length} linhas; o limite é ${MAX_LINHAS}`,
        );
        return;
      }

      const cols = Object.keys(dados[0]);
      const mapeamento = autoMapear(cols);
      setLinhas(dados);
      setColunas(cols);
      setMapa(mapeamento);
      setNomeArquivo(file.name);

      // Já resolve os códigos: sem isso o operador mapeia as colunas às cegas
      // e só descobre no fim que nenhuma casou.
      if (mapeamento.codigo) {
        await resolver(dados, mapeamento.codigo);
      }
    } catch {
      toast.error("Não consegui ler esta planilha. Envie um CSV ou XLSX.");
    } finally {
      setLendo(false);
    }
  };

  const resolver = async (dados: LinhaPlanilha[], coluna: string) => {
    const codes = [
      ...new Set(
        dados
          .map((linha) => String(linha[coluna] ?? "").trim())
          .filter((code) => code.length > 0),
      ),
    ];
    if (codes.length === 0) {
      setProdutos(new Map());
      return;
    }
    try {
      const { products } = await client.purchase.findProductsByCodes({ codes });
      const mapaProdutos = new Map<string, PickedProduct>();
      for (const product of products) {
        // Indexado pelos DOIS códigos: a planilha pode trazer ora o EAN, ora o
        // código interno, e às vezes os dois na mesma coluna.
        if (product.barcode) mapaProdutos.set(product.barcode, product);
        if (product.sku) mapaProdutos.set(product.sku, product);
      }
      setProdutos(mapaProdutos);
    } catch {
      toast.error("Não consegui consultar os produtos da planilha");
    }
  };

  const trocarColuna = async (campo: CampoItem, coluna: string) => {
    const valor = coluna === NENHUMA ? undefined : coluna;
    setMapa((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "codigo") {
      if (valor) await resolver(linhas, valor);
      else setProdutos(new Map());
    }
  };

  const { prontos, ignorados } = resolverLinhas(linhas, mapa, produtos);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
    maxSize: TAMANHO_MAX,
    onDrop: (aceitos) => {
      if (aceitos[0]) void receber(aceitos[0]);
    },
    onDropRejected: () => toast.error("Envie um único CSV ou XLSX de até 5 MB"),
  });

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) limpar();
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      {/* Altura fixa e o diálogo não rola: só a tabela de conferência rola,
          para o rodapé com o botão de confirmar nunca sair da vista. */}
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Importar itens por planilha</DialogTitle>
          <DialogDescription>
            A planilha preenche os itens desta nota. Nada é gravado nem entra no
            estoque agora — você confere na tela e decide depois.
          </DialogDescription>
        </DialogHeader>

        {linhas.length === 0 ? (
          <div
            {...getRootProps()}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center transition-colors",
              isDragActive ? "border-primary bg-accent" : "hover:bg-accent/50",
            )}
          >
            <input {...getInputProps()} />
            {lendo ? (
              <Spinner />
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">
                    Arraste a planilha ou clique para escolher
                  </p>
                  <p className="text-sm text-muted-foreground">
                    CSV ou XLSX, até 5 MB e {MAX_LINHAS} linhas. Precisa de uma
                    coluna com o código de barras ou SKU e outra com a
                    quantidade.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4 shrink-0" />
              <span className="truncate">{nomeArquivo}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0"
                onClick={limpar}
              >
                Trocar arquivo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CAMPOS_ITEM.map((campo) => (
                <div key={campo.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`col-${campo.key}`} className="text-xs">
                    {campo.label}
                    {campo.obrigatorio && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Select
                    value={mapa[campo.key] ?? NENHUMA}
                    onValueChange={(valor) =>
                      void trocarColuna(campo.key, valor)
                    }
                  >
                    <SelectTrigger id={`col-${campo.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUMA}>—</SelectItem>
                      {colunas.map((coluna) => (
                        <SelectItem key={coluna} value={coluna}>
                          {coluna}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {ignorados.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {ignorados.length}{" "}
                    {ignorados.length === 1
                      ? "linha ignorada"
                      : "linhas ignoradas"}
                  </p>
                  <p className="text-muted-foreground">
                    {/* Só as primeiras: a lista inteira empurraria a tabela de
                        conferência para fora da tela. */}
                    {ignorados
                      .slice(0, 6)
                      .map((linha) => `linha ${linha.numero} (${linha.motivo})`)
                      .join(" · ")}
                    {ignorados.length > 6 &&
                      ` · e mais ${ignorados.length - 6}`}
                  </p>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd.</TableHead>
                    <TableHead className="text-right">Compra</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prontos.map((item) => (
                    <TableRow key={`${item.numero}-${item.product.id}`}>
                      <TableCell>
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.product.sku || item.product.barcode}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {currencyFormatter(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {currencyFormatter(item.discount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {currencyFormatter(
                          item.quantity * item.unitPrice - item.discount,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {prontos.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma linha pronta. Confira o mapeamento das colunas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => fechar(false)}>
            Cancelar
          </Button>
          <Button
            disabled={prontos.length === 0}
            onClick={() => {
              onImport(prontos);
              fechar(false);
            }}
          >
            Adicionar {prontos.length} {prontos.length === 1 ? "item" : "itens"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
