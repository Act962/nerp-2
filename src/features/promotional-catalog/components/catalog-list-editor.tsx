"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  UploadCloud,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Columns3,
  ImageIcon,
  Sparkles,
  Table as TableIcon,
  Folder,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  LIST_FIELDS,
  autoMapColumns,
  type ListMapping,
} from "../catalog-list-fields";
import type {
  CardLayoutElement,
  CatalogConfig,
  CatalogList,
  CatalogListItem,
  CatalogProduct,
} from "../types";
import { resolveFolders, virtualProductsFromList } from "../types";
import { ProductNameSearch } from "./product-name-search";
import { ProductPhotoButton } from "./config-panel";
import { CatalogListWizard, type WizardResult } from "./catalog-list-wizard";
import {
  useExtractOffersFromFile,
  useMatchProductsByName,
  useCreateOfferProducts,
  useProductThumbnails,
} from "../hooks/use-catalog";

// Colunas que podem ser mostradas/ocultadas (Produto é sempre exibido).
const TOGGLE_COLUMNS = [
  { key: "image", label: "Imagem" },
  { key: "normalPrice", label: "Preço normal" },
  { key: "offerPrice", label: "Preço oferta" },
  { key: "department", label: "Departamento" },
  { key: "client", label: "Cliente" },
] as const;
type ColumnKey = (typeof TOGGLE_COLUMNS)[number]["key"];

const NONE = "__none__";
const PREVIEW_ROWS = 6;

interface CatalogListEditorProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  // `override` gera a partir de um config já resolvido (wizard), sem esperar o
  // flush do estado.
  onGenerate: (override?: CatalogConfig) => void;
  // Salvar o card ("Montar card") — reusa o mesmo fluxo do "Editar produto".
  onSaveCardLayout?: (
    scope: "product" | "page" | "all",
    layout: CardLayoutElement[],
    productId: string,
  ) => void;
  // Preview do catálogo (25% à direita, entre a barra "Gerar catálogo" e as
  // pastas). Montado pelo editor pai, que tem as páginas/produtos resolvidos.
  preview?: ReactNode;
  // Pasta (key) da página atual na prévia — o rodapé acompanha a paginação.
  activeFolderFromPreview?: string | null;
  // Clique numa pasta do rodapé → a prévia navega até a página daquela pasta.
  onSelectFolder?: (key: string) => void;
}

type ParsedSheet = { columns: string[]; rows: Record<string, string>[] };

// "1.234,56" / "R$ 9,90" / "9.90" → número.
function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim()) {
    const c = v.replace(/[^0-9.,]/g, "");
    const n = Number(
      c.includes(",") ? c.replace(/\./g, "").replace(",", ".") : c,
    );
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Math.floor(performance.now() * 1000)}`;

async function parseSheetPreview(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  return { columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.slice(s.indexOf(",") + 1)); // remove "data:...;base64,"
    };
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

// Máx. de produtos por página = maior nº de itens de um mesmo cliente.
function maxPerClient(items: CatalogListItem[]): number {
  const counts = new Map<string, number>();
  for (const it of items)
    counts.set(it.client, (counts.get(it.client) ?? 0) + 1);
  return Math.max(1, ...(counts.size ? [...counts.values()] : [1]));
}

export function CatalogListEditor({
  config,
  onConfigChange,
  onGenerate,
  onSaveCardLayout,
  preview,
  activeFolderFromPreview,
  onSelectFolder,
}: CatalogListEditorProps) {
  const list = config.list;
  const items = list?.items ?? [];
  const [pending, setPending] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ListMapping>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Linhas recém-importadas aguardando o wizard (null = editor normal).
  const [wizardRows, setWizardRows] = useState<CatalogListItem[] | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  // Colunas ocultas (só exibição) e a linha em "Editar produto".
  const [hiddenCols, setHiddenCols] = useState<Set<ColumnKey>>(new Set());
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const showCol = (key: ColumnKey) => !hiddenCols.has(key);
  // Confirmação do "Cadastrar novos".
  const [confirmRegister, setConfirmRegister] = useState(false);

  // Rodapé acompanha o scroll da prévia: a pasta da página mais visível na
  // prévia vira a pasta ativa (e filtra a tabela por ela).
  useEffect(() => {
    if (activeFolderFromPreview != null)
      setActiveFolder(activeFolderFromPreview);
  }, [activeFolderFromPreview]);

  const extract = useExtractOffersFromFile();
  const matchProducts = useMatchProductsByName();
  const createProducts = useCreateOfferProducts();

  // Produtos (virtuais) por id, para abrir "Editar produto" a partir da linha.
  const vProducts = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const p of virtualProductsFromList(list)) map.set(p.id, p);
    return map;
  }, [list]);
  const editProduct = editRowId ? vProducts.get(editRowId) : undefined;

  // Aplica um patch no config.list preservando os demais campos (groupBy,
  // folderNames, offerName…) que os handlers antigos descartavam.
  const patchList = useCallback(
    (patch: Partial<CatalogList>) => {
      onConfigChange({
        list: {
          items: list?.items ?? [],
          mapping: list?.mapping,
          maxPerPage: list?.maxPerPage,
          groupBy: list?.groupBy,
          folderNames: list?.folderNames,
          offerName: list?.offerName,
          ...patch,
        },
      });
    },
    [onConfigChange, list],
  );

  const setItems = useCallback(
    (next: CatalogListItem[], keepMax = false) => {
      patchList({
        items: next,
        maxPerPage: keepMax
          ? (list?.maxPerPage ?? maxPerClient(next))
          : maxPerClient(next),
      });
    },
    [patchList, list?.maxPerPage],
  );

  // ── Reconciliar fotos com o cadastro ──
  // Linhas casadas (com productId) devem mostrar a foto ATUAL do produto no
  // banco. O snapshot da linha (item.thumbnail) pode ficar defasado quando a
  // foto muda no cadastro — então buscamos as fotos por id e atualizamos.
  const linkedIds = useMemo(
    () => [
      ...new Set(
        items.map((i) => i.productId).filter((id): id is string => !!id),
      ),
    ],
    [items],
  );
  const { data: dbThumbs, refetch: refetchThumbs } =
    useProductThumbnails(linkedIds);
  const dbThumbMap = useMemo(
    () => new Map((dbThumbs ?? []).map((t) => [t.id, t.thumbnail])),
    [dbThumbs],
  );
  // Reconcilia quando as fotos do banco chegam/mudam (uma vez por carga).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage só a dbThumbs
  useEffect(() => {
    if (!dbThumbs || dbThumbs.length === 0) return;
    let changed = false;
    const next = items.map((it) => {
      if (!it.productId) return it;
      const dbT = dbThumbMap.get(it.productId);
      if (dbT && dbT !== (it.thumbnail ?? "")) {
        changed = true;
        return { ...it, thumbnail: dbT };
      }
      return it;
    });
    if (changed) setItems(next, true);
  }, [dbThumbs]);

  // Nomes distintos de produtos SEM vínculo com o cadastro (item.productId).
  const unregisteredNames = useMemo(
    () => [
      ...new Set(
        items
          .filter((i) => !i.productId && i.productName)
          .map((i) => i.productName),
      ),
    ],
    [items],
  );

  // ── Cadastrar/casar os produtos novos no banco e vincular as linhas. Dedup
  // por nome: cria 1 produto por nome distinto e vincula TODAS as linhas com
  // aquele nome. MEXE no banco (opt-in, com confirmação). ──
  const registerProducts = async () => {
    setConfirmRegister(false);
    if (unregisteredNames.length === 0) return;
    setBusy("register");
    try {
      // 1) Casa com produtos já existentes no cadastro.
      const matched = await matchProducts.mutateAsync({
        names: unregisteredNames,
      });
      const byName = new Map<
        string,
        { productId: string; thumbnail: string }
      >();
      for (const r of matched)
        if (r.productId)
          byName.set(r.name, {
            productId: r.productId,
            thumbnail: r.thumbnail ?? "",
          });
      // 2) Cria os que ainda não existem (um por nome).
      const toCreate = unregisteredNames.filter((n) => !byName.has(n));
      if (toCreate.length > 0) {
        const payload = toCreate.map((name) => {
          const row = items.find((i) => i.productName === name);
          return { name, salePrice: row?.normalPrice ?? row?.offerPrice ?? 0 };
        });
        const created = await createProducts.mutateAsync({ products: payload });
        created.forEach((r, i) => {
          if (r.productId)
            byName.set(toCreate[i], { productId: r.productId, thumbnail: "" });
        });
      }
      // 3) Vincula TODAS as linhas (por nome) ao produto do cadastro.
      const next = items.map((it) => {
        if (it.productId) return it;
        const hit = byName.get(it.productName);
        if (!hit) return it;
        return {
          ...it,
          productId: hit.productId,
          ...(it.thumbnail ? {} : { thumbnail: hit.thumbnail }),
        };
      });
      setItems(next, true);
      toast.success(
        `${byName.size} produto(s) cadastrado(s)/vinculado(s) ao banco.`,
      );
    } catch {
      toast.error("Falha ao cadastrar os produtos.");
    } finally {
      setBusy(null);
    }
  };

  // ── Importar arquivo (planilha → mapeamento; PDF/imagem → IA). ADICIONA à
  // lista existente (não substitui) — botão "Adicionar nova planilha". ──
  const onDrop = async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const isSheet =
      /\.(xlsx|xls|csv)$/i.test(file.name) ||
      file.type.includes("sheet") ||
      file.type.includes("csv") ||
      file.type.includes("excel");
    try {
      if (isSheet) {
        const parsed = await parseSheetPreview(file);
        if (parsed.columns.length === 0) {
          toast.error("Não consegui ler colunas do arquivo.");
          return;
        }
        setPending(parsed);
        setMapping(autoMapColumns(parsed.columns));
      } else {
        // PDF / imagem → IA
        setBusy("extract");
        const base64 = await fileToBase64(file);
        const res = await extract.mutateAsync({
          base64,
          mimeType: file.type || "application/pdf",
        });
        const next: CatalogListItem[] = res.offers.map((o) => ({
          id: uid(),
          client: o.client?.trim() || "Sem cliente",
          productName: o.productName,
          normalPrice: o.normalPrice ?? undefined,
          offerPrice: o.offerPrice ?? undefined,
          department: o.department ?? undefined,
          startDate: o.startDate ?? undefined,
          endDate: o.endDate ?? undefined,
        }));
        if (next.length === 0) {
          toast.error("A IA não encontrou ofertas neste arquivo.");
          return;
        }
        setWizardRows(next);
        toast.success(`${next.length} oferta(s) extraída(s) pela IA.`);
      }
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Falha ao ler o arquivo.",
      );
    } finally {
      setBusy(null);
    }
  };

  const { getInputProps, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    maxFiles: 1,
    maxSize: 8 * 1024 * 1024,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv", ".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
  });

  const missingRequired = useMemo(
    () =>
      LIST_FIELDS.filter((f) => f.required && !mapping[f.key]).map(
        (f) => f.label,
      ),
    [mapping],
  );

  const confirmMapping = () => {
    if (!pending) return;
    if (missingRequired.length > 0) {
      toast.error(`Mapeie: ${missingRequired.join(", ")}`);
      return;
    }
    const get = (row: Record<string, string>, key: keyof ListMapping) => {
      const col = mapping[key];
      return col ? row[col] : undefined;
    };
    const next: CatalogListItem[] = pending.rows
      .map((row) => ({
        id: uid(),
        client: String(get(row, "client") ?? "").trim() || "Sem cliente",
        productName: String(get(row, "productName") ?? "").trim(),
        normalPrice: toNum(get(row, "normalPrice")),
        offerPrice: toNum(get(row, "offerPrice")),
        department: String(get(row, "department") ?? "").trim() || undefined,
        startDate: String(get(row, "startDate") ?? "").trim() || undefined,
        endDate: String(get(row, "endDate") ?? "").trim() || undefined,
      }))
      .filter((it) => it.productName);
    // Guarda o mapping (contexto de reimport) e manda as novas linhas ao wizard.
    patchList({ mapping });
    setPending(null);
    setWizardRows(next);
    toast.success(`${next.length} item(ns) lido(s). Vamos organizar.`);
  };

  // ── Conclusão do wizard: monta o config resolvido e gera numa tacada só
  // (passa o override p/ não depender do flush do setState). ──
  const applyWizard = (r: WizardResult) => {
    const nextConfig: CatalogConfig = {
      ...config,
      ...(r.offerValidUntil ? { offerValidUntil: r.offerValidUntil } : {}),
      list: {
        items: r.items,
        mapping: list?.mapping,
        maxPerPage: r.maxPerPage,
        groupBy: r.groupBy,
        folderNames: r.folderNames,
        offerName: r.offerName,
      },
      // Fundo escolhido no wizard (preset / cor / imagem) — já traz os campos
      // corretos (inclusive backgroundImage/pageAspect quando é imagem).
      ...(r.background ?? {}),
    };
    setWizardRows(null);
    setActiveFolder(null);
    onGenerate(nextConfig);
  };

  const updateItem = (id: string, patch: Partial<CatalogListItem>) =>
    setItems(
      items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      true,
    );
  const removeItem = (id: string) =>
    setItems(
      items.filter((it) => it.id !== id),
      true,
    );
  // Reordena um item DENTRO do seu cliente/pasta (troca com o vizinho na ordem
  // exibida). Como a ordem vive em `list.items`, a PÁGINA acompanha ao vivo.
  const canMoveItem = (id: string, dir: -1 | 1): boolean => {
    const it = items.find((i) => i.id === id);
    if (!it) return false;
    const group = ordered.filter((x) => x.client === it.client);
    const pos = group.findIndex((x) => x.id === id);
    return pos + dir >= 0 && pos + dir < group.length;
  };
  const moveListItem = (id: string, dir: -1 | 1) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const group = ordered.filter((x) => x.client === it.client);
    const pos = group.findIndex((x) => x.id === id);
    const target = pos + dir;
    if (target < 0 || target >= group.length) return;
    const bId = group[target].id;
    const next = [...items];
    const ai = next.findIndex((x) => x.id === id);
    const bi = next.findIndex((x) => x.id === bId);
    [next[ai], next[bi]] = [next[bi], next[ai]];
    setItems(next, true);
  };
  const addRow = () => {
    const last = items[items.length - 1];
    const row: CatalogListItem = {
      id: uid(),
      client: last?.client ?? "Sem cliente",
      productName: "",
    };
    // A tabela pode estar filtrada por uma pasta (aba ativa / prévia). Preenche
    // o campo de agrupamento para a nova linha CAIR nessa pasta — senão o filtro
    // a esconde e parece que "não adicionou".
    const gb = list?.groupBy ?? "client";
    if (activeFolder) {
      if (gb === "department") row.department = activeFolder;
      else if (gb === "custom") row.folder = activeFolder;
      else row.client = activeFolder;
    }
    setItems([...items, row], true);
  };

  const clientCount = useMemo(
    () => new Set(items.map((i) => i.client)).size,
    [items],
  );
  // Ordena por cliente (agrupa visualmente) preservando a ordem de aparição.
  const ordered = useMemo(() => {
    const order = new Map<string, number>();
    items.forEach((i) => {
      if (!order.has(i.client)) order.set(i.client, order.size);
    });
    return [...items].sort(
      (a, b) => (order.get(a.client) ?? 0) - (order.get(b.client) ?? 0),
    );
  }, [items]);

  const groupBy = list?.groupBy ?? "client";
  const folders = useMemo(() => resolveFolders(list), [list]);
  // Tabela filtrada pela pasta (aba) ativa.
  const visibleItems = useMemo(() => {
    if (!activeFolder) return ordered;
    const ids = new Set(
      folders.find((f) => f.key === activeFolder)?.itemIds ?? [],
    );
    return ordered.filter((it) => ids.has(it.id));
  }, [ordered, activeFolder, folders]);

  // ── Render: SEMPRE a tabela (vazia ou não) + modal de mapeamento ──
  let lastClient = "";
  const mappingPreview = pending?.rows.slice(0, PREVIEW_ROWS) ?? [];

  // Wizard ocupa a área toda quando há linhas recém-importadas.
  if (wizardRows) {
    return (
      <div className="flex h-full flex-col">
        <input {...getInputProps()} />
        <CatalogListWizard
          rows={wizardRows}
          existingItems={items}
          catalogName={list?.offerName ?? config.title ?? ""}
          onApply={applyWizard}
          onCancel={() => setWizardRows(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <input {...getInputProps()} />

      {/* "Editar produto" da linha (montado só p/ a linha em edição; o gatilho
          fica oculto — quem abre é a miniatura da tabela). */}
      {editProduct && (
        <div className="hidden">
          <ProductPhotoButton
            product={editProduct}
            config={config}
            onConfigChange={onConfigChange}
            onSaveCardLayout={onSaveCardLayout}
            open
            onOpenChange={(o) => {
              if (!o) setEditRowId(null);
            }}
          />
        </div>
      )}

      {/* Confirmação do "Cadastrar novos" (mexe no banco) */}
      <Dialog open={confirmRegister} onOpenChange={setConfirmRegister}>
        <DialogContent className="max-w-md">
          <DialogTitle>Cadastrar produtos no banco</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Isso vai casar com produtos já existentes e{" "}
            <strong>criar no cadastro</strong> os que faltarem —{" "}
            <strong>{unregisteredNames.length}</strong> produto(s) distinto(s) —
            e vincular as linhas correspondentes. A ação altera o banco de
            produtos da sua organização.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRegister(false)}>
              Cancelar
            </Button>
            <Button onClick={registerProducts}>
              <PackagePlus className="mr-1 h-4 w-4" />
              Cadastrar {unregisteredNames.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de mapeamento de colunas (planilha) */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>
            Relacione as colunas ({pending?.rows.length ?? 0} linhas)
          </DialogTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIST_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-sm font-medium">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive">*</span>
                  )}
                </span>
                <Select
                  value={mapping[field.key] ?? NONE}
                  onValueChange={(v) =>
                    setMapping((prev) => {
                      const nextm = { ...prev };
                      if (v === NONE) delete nextm[field.key];
                      else nextm[field.key] = v;
                      return nextm;
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="— não importar —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— não importar —</SelectItem>
                    {(pending?.columns ?? []).map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.hint && (
                  <span className="text-[11px] text-muted-foreground">
                    {field.hint}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="max-h-[30vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(pending?.columns ?? []).map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingPreview.map((row, i) => (
                  <TableRow key={i}>
                    {(pending?.columns ?? []).map((c) => (
                      <TableCell key={c} className="max-w-[180px] truncate">
                        {row[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmMapping}>
              Adicionar {pending?.rows.length ?? 0} linha(s)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="mr-auto flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {items.length} produto(s) · {clientCount} cliente(s)
          </span>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Agrupar por
            <Select
              value={groupBy}
              onValueChange={(v) => {
                patchList({ groupBy: v as CatalogList["groupBy"] });
                setActiveFolder(null);
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="department">Departamento</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Máx./página
          <Input
            type="number"
            min={1}
            max={24}
            value={list?.maxPerPage ?? maxPerClient(items)}
            onChange={(e) =>
              patchList({
                maxPerPage: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="h-8 w-16 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={open}
        >
          {busy === "extract" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-1 h-4 w-4" />
          )}
          {busy === "extract" ? "Lendo com IA…" : "Adicionar nova planilha"}
        </Button>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar linha
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Columns3 className="mr-1 h-4 w-4" />
              Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-2">
            <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
              Mostrar colunas
            </p>
            {TOGGLE_COLUMNS.map((c) => (
              <label
                key={c.key}
                htmlFor={`listcol-${c.key}`}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  id={`listcol-${c.key}`}
                  checked={showCol(c.key)}
                  onCheckedChange={(v) =>
                    setHiddenCols((prev) => {
                      const next = new Set(prev);
                      if (v) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })
                  }
                />
                {c.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        {linkedIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            title="Puxar as fotos atuais do cadastro para as linhas casadas"
            onClick={() => refetchThumbs()}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Atualizar fotos
          </Button>
        )}
        {unregisteredNames.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setConfirmRegister(true)}
          >
            {busy === "register" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-1 h-4 w-4" />
            )}
            Cadastrar novos ({unregisteredNames.length})
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => onConfigChange({ list: undefined })}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Limpar lista
        </Button>
        <Button size="sm" onClick={() => onGenerate()}>
          <Sparkles className="mr-1 h-4 w-4" />
          Gerar catálogo
        </Button>
      </div>

      {/* Tabela (à esquerda) + Preview 25% (à direita) — entre a barra de ações
          "Gerar catálogo" e o rodapé de pastas. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                {showCol("image") && <TableHead className="w-16" />}
                <TableHead className="min-w-[220px]">Produto</TableHead>
                {showCol("normalPrice") && (
                  <TableHead className="w-28">Preço normal</TableHead>
                )}
                {showCol("offerPrice") && (
                  <TableHead className="w-28">Preço oferta</TableHead>
                )}
                {showCol("department") && (
                  <TableHead className="w-32">Departamento</TableHead>
                )}
                {showCol("client") && (
                  <TableHead className="w-40">Cliente</TableHead>
                )}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      2 + TOGGLE_COLUMNS.filter((c) => showCol(c.key)).length
                    }
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Lista vazia. Clique em{" "}
                    <strong>"Adicionar nova planilha"</strong> (planilha, PDF ou
                    imagem) ou <strong>"Adicionar linha"</strong> para começar.
                  </TableCell>
                </TableRow>
              )}
              {visibleItems.map((it) => {
                const showClientDivider = it.client !== lastClient;
                lastClient = it.client;
                // Foto: o snapshot da linha ou, se vazio, a foto atual do cadastro.
                const thumbKey =
                  it.thumbnail ||
                  (it.productId ? (dbThumbMap.get(it.productId) ?? "") : "");
                const img = thumbKey ? constructUrl(thumbKey) : "";
                return (
                  <TableRow key={it.id}>
                    {showCol("image") && (
                      <TableCell className="p-1">
                        <button
                          type="button"
                          title="Editar produto"
                          onClick={() => setEditRowId(it.id)}
                          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded border bg-muted transition-opacity hover:opacity-80"
                        >
                          {img ? (
                            // biome-ignore lint/performance/noImgElement: prévia local
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="p-1">
                      <div className="flex items-center gap-2">
                        <ProductNameSearch
                          value={it.productName}
                          onChange={(name) =>
                            updateItem(it.id, { productName: name })
                          }
                          onPick={(p) =>
                            updateItem(it.id, {
                              productName: p.name,
                              productId: p.id,
                              thumbnail: p.thumbnail,
                              ...(it.normalPrice == null
                                ? { normalPrice: p.salePrice }
                                : {}),
                              ...(!it.department && p.categoryName
                                ? { department: p.categoryName }
                                : {}),
                            })
                          }
                          className="h-8 flex-1"
                        />
                        <span
                          title={
                            it.productId
                              ? "Vinculado a um produto do cadastro"
                              : "Produto avulso (não está no cadastro)"
                          }
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            it.productId
                              ? "bg-green-500/15 text-green-700 dark:text-green-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {it.productId ? "cadastrado" : "novo"}
                        </span>
                      </div>
                    </TableCell>
                    {showCol("normalPrice") && (
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.normalPrice ?? ""}
                          onChange={(e) =>
                            updateItem(it.id, {
                              normalPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          className="h-8"
                        />
                      </TableCell>
                    )}
                    {showCol("offerPrice") && (
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.offerPrice ?? ""}
                          onChange={(e) =>
                            updateItem(it.id, {
                              offerPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          className="h-8"
                        />
                      </TableCell>
                    )}
                    {showCol("department") && (
                      <TableCell className="p-1">
                        <Input
                          value={it.department ?? ""}
                          onChange={(e) =>
                            updateItem(it.id, {
                              department: e.target.value || undefined,
                            })
                          }
                          className="h-8"
                        />
                      </TableCell>
                    )}
                    {showCol("client") && (
                      <TableCell className="p-1">
                        <Input
                          value={it.client}
                          onChange={(e) =>
                            updateItem(it.id, {
                              client: e.target.value || "Sem cliente",
                            })
                          }
                          className={cn(
                            "h-8",
                            showClientDivider &&
                              "border-primary/40 font-medium",
                          )}
                        />
                      </TableCell>
                    )}
                    <TableCell className="p-1">
                      <div className="flex items-center">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                            title="Mover para cima"
                            disabled={!canMoveItem(it.id, -1)}
                            onClick={() => moveListItem(it.id, -1)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                            title="Mover para baixo"
                            disabled={!canMoveItem(it.id, 1)}
                            onClick={() => moveListItem(it.id, 1)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(it.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {preview && (
          <div className="hidden w-1/4 min-w-0 shrink-0 flex-col border-l bg-neutral-200 dark:bg-neutral-800 lg:flex">
            {preview}
          </div>
        )}
      </div>

      {/* Rodapé de abas (pastas = páginas), estilo Excel */}
      {folders.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-t bg-muted/30 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveFolder(null)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFolder === null
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Todos ({items.length})
          </button>
          {folders.map((f) => (
            <div key={f.key} className="shrink-0">
              {renamingKey === f.key ? (
                <Input
                  autoFocus
                  defaultValue={f.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    patchList({
                      folderNames: {
                        ...(list?.folderNames ?? {}),
                        [f.key]: name || f.key,
                      },
                    });
                    setRenamingKey(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenamingKey(null);
                  }}
                  className="h-7 w-36 text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFolder(f.key);
                    onSelectFolder?.(f.key);
                  }}
                  onDoubleClick={() => setRenamingKey(f.key)}
                  title="Duplo-clique para renomear"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    activeFolder === f.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Folder className="h-3 w-3" />
                  {f.name}
                  <span className="opacity-60">({f.itemIds.length})</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
