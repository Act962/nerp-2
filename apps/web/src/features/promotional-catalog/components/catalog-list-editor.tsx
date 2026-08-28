"use client";

import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
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
import { virtualProductsFromList } from "../types";
import {
  isScientificNotation,
  matchKey,
  normalizeCode,
} from "../lib/product-match";
import { ProductNameSearch, type PickedProduct } from "./product-name-search";
import { groupIdByProduct, removeFromOtherGroups } from "../lib/group-slices";
import { applyProductPrice, ProductPhotoButton } from "./config-panel";
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
  { key: "code", label: "Código" },
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
    scope: "product" | "page" | "group" | "all",
    layout: CardLayoutElement[],
    productId: string,
    groupId?: string | null,
  ) => void;
  // Preview do catálogo (25% à direita, entre a barra "Gerar catálogo" e as
  // pastas). Montado pelo editor pai, que tem as páginas/produtos resolvidos.
  preview?: ReactNode;
  // Produtos resolvidos (lista + cadastro) — para mostrar na Lista os produtos
  // MANUAIS (do cadastro) que foram agrupados numa página, sob o divisor do grupo.
  resolvedProducts?: CatalogProduct[];
  // Pasta (key) da página atual na prévia — o rodapé acompanha a paginação.
  activeFolderFromPreview?: string | null;
  // Clique numa pasta do rodapé → a prévia navega até a página daquela pasta.
  onSelectFolder?: (key: string) => void;
  // Cria uma nova página (chamado pelo "+" do rodapé de pastas).
  onAddPage?: () => void;
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

// Teto de upload da aba "Lista". O servidor corta em ~8,5 MB
// (`base64.max(12_000_000)` em `extract-offers-from-file.ts`), então subir este
// número aqui sem mexer lá só troca uma rejeição silenciosa por um erro 400.
const MAX_UPLOAD_MB = 8;

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
  resolvedProducts,
  activeFolderFromPreview,
  onSelectFolder,
  onAddPage,
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

  // ── FONTE ÚNICA: `pages[].productIds`. Cada PÁGINA é uma "pasta" na Lista
  // (key = page.id, nome = page.name, membros = page.productIds). A Lista e a
  // Página leem daqui, então adicionar/apagar reflete nos dois lados. ──
  const pages = config.pages ?? [];
  const folders = useMemo(
    () =>
      (config.pages ?? []).map((pg, i) => ({
        key: pg.id,
        name: pg.name?.trim() || `Página ${i + 1}`,
        itemIds: pg.productIds ?? [],
      })),
    [config.pages],
  );
  const activePage = useMemo(
    () =>
      activeFolder
        ? (config.pages ?? []).find((pg) => pg.id === activeFolder)
        : undefined,
    [activeFolder, config.pages],
  );
  const listItemById = useMemo(
    () => new Map((config.list?.items ?? []).map((it) => [it.id, it])),
    [config.list],
  );
  const productById = useMemo(
    () => new Map((resolvedProducts ?? []).map((p) => [p.id, p])),
    [resolvedProducts],
  );

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

  // Produtos distintos SEM vínculo com o cadastro (item.productId).
  // A identidade é o `matchKey`: com código, é o código; SEM código, é o nome
  // normalizado — ou seja, planilha sem a coluna "Código" agrupa como sempre.
  const unregisteredTargets = useMemo(() => {
    const map = new Map<string, { name: string; code?: string }>();
    for (const it of items) {
      if (it.productId || !it.productName) continue;
      const key = matchKey(it);
      if (!map.has(key))
        map.set(key, { name: it.productName, code: it.code || undefined });
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }));
  }, [items]);

  // ── Cadastrar/casar os produtos novos no banco e vincular as linhas. Dedup
  // por nome: cria 1 produto por nome distinto e vincula TODAS as linhas com
  // aquele nome. MEXE no banco (opt-in, com confirmação). ──
  const registerProducts = async () => {
    setConfirmRegister(false);
    if (unregisteredTargets.length === 0) return;
    setBusy("register");
    try {
      // 1) Casa com produtos já existentes no cadastro (código → nome).
      const matched = await matchProducts.mutateAsync({
        items: unregisteredTargets.map((t) => ({
          name: t.name,
          code: t.code,
        })),
      });
      const byKey = new Map<
        string,
        {
          productId: string;
          thumbnail: string;
          source?: CatalogListItem["matchSource"];
        }
      >();
      for (const r of matched)
        if (r.productId)
          byKey.set(matchKey({ productName: r.name, code: r.code }), {
            productId: r.productId,
            thumbnail: r.thumbnail ?? "",
            source: r.source ?? undefined,
          });
      // 2) Cria os que ainda não existem (um por produto distinto).
      const toCreate = unregisteredTargets.filter((t) => !byKey.has(t.key));
      if (toCreate.length > 0) {
        const payload = toCreate.map((t) => {
          const row = items.find((i) => matchKey(i) === t.key);
          return {
            name: t.name,
            salePrice: row?.normalPrice ?? row?.offerPrice ?? 0,
            // `@@unique([organizationId, barcode])`: só manda código válido.
            ...(normalizeCode(t.code)
              ? { barcode: normalizeCode(t.code) }
              : {}),
          };
        });
        const created = await createProducts.mutateAsync({ products: payload });
        created.forEach((r, i) => {
          if (r.productId)
            byKey.set(toCreate[i].key, {
              productId: r.productId,
              thumbnail: "",
              source: "manual",
            });
        });
      }
      // 3) Vincula TODAS as linhas do mesmo produto ao registro do cadastro.
      const next = items.map((it) => {
        if (it.productId) return it;
        const hit = byKey.get(matchKey(it));
        if (!hit) return it;
        return {
          ...it,
          productId: hit.productId,
          ...(hit.source ? { matchSource: hit.source } : {}),
          ...(it.thumbnail ? {} : { thumbnail: hit.thumbnail }),
        };
      });
      setItems(next, true);
      toast.success(
        `${byKey.size} produto(s) cadastrado(s)/vinculado(s) ao banco.`,
      );
    } catch {
      toast.error("Falha ao cadastrar os produtos.");
    } finally {
      setBusy(null);
    }
  };

  // ── "Recasar produtos": reconfere o vínculo de cada linha com o cadastro
  // usando a cascata atual (código → nome exato → prefixo). Só PROPÕE — o
  // usuário confirma vendo quantas linhas mudariam. Linhas escolhidas à mão
  // (matchSource "manual") são preservadas. ──
  const [recheckPlan, setRecheckPlan] = useState<{
    next: CatalogListItem[];
    changed: number;
  } | null>(null);

  const runRecheck = async () => {
    const targets = new Map<string, { name: string; code?: string }>();
    for (const it of items) {
      if (!it.productName || it.matchSource === "manual") continue;
      const key = matchKey(it);
      if (!targets.has(key))
        targets.set(key, { name: it.productName, code: it.code || undefined });
    }
    if (targets.size === 0) {
      toast.info("Nada a recasar.");
      return;
    }
    setBusy("recheck");
    try {
      const res = await matchProducts.mutateAsync({
        items: [...targets.values()],
      });
      const byKey = new Map(
        res.map((r) => [matchKey({ productName: r.name, code: r.code }), r]),
      );
      let changed = 0;
      const next = items.map((it) => {
        if (it.matchSource === "manual") return it;
        const hit = byKey.get(matchKey(it));
        if (!hit?.productId) return it;
        const sameProduct = it.productId === hit.productId;
        const sameThumb = (it.thumbnail ?? "") === (hit.thumbnail ?? "");
        if (sameProduct && sameThumb) return it;
        changed++;
        return {
          ...it,
          productId: hit.productId,
          thumbnail: hit.thumbnail ?? "",
          ...(hit.source ? { matchSource: hit.source } : {}),
        };
      });
      if (changed === 0) {
        toast.success("Tudo certo — nenhum vínculo precisou mudar.");
        return;
      }
      setRecheckPlan({ next, changed });
    } catch {
      toast.error("Falha ao recasar os produtos.");
    } finally {
      setBusy(null);
    }
  };

  // ── Importar arquivo (planilha → mapeamento; PDF/imagem → IA). ADICIONA à
  // lista existente (não substitui) — botão "Adicionar nova planilha". ──
  const onDrop = async (accepted: File[], rejected: FileRejection[] = []) => {
    // Sem isto o arquivo grande demais some SEM MENSAGEM: o dropzone manda a
    // rejeição por este segundo argumento, que era ignorado. Foi o que fez um
    // encarte de 108 MB "não acontecer nada" ao ser solto aqui.
    const rej = rejected[0];
    if (rej) {
      const tooBig = rej.errors.some((e) => e.code === "file-too-large");
      toast.error(
        tooBig
          ? `Arquivo grande demais (máx. ${MAX_UPLOAD_MB} MB). Para um encarte extenso, use uma planilha ou divida o PDF.`
          : "Formato não aceito. Envie .xlsx, .csv, .pdf ou .jpg.",
      );
      return;
    }
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
    maxSize: MAX_UPLOAD_MB * 1024 * 1024,
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
        code: String(get(row, "code") ?? "").trim() || undefined,
        normalPrice: toNum(get(row, "normalPrice")),
        offerPrice: toNum(get(row, "offerPrice")),
        department: String(get(row, "department") ?? "").trim() || undefined,
        startDate: String(get(row, "startDate") ?? "").trim() || undefined,
        endDate: String(get(row, "endDate") ?? "").trim() || undefined,
      }))
      .filter((it) => it.productName);
    // O Excel guarda EAN longo como número e devolve "7,89E+12" — os dígitos
    // já se perderam na origem. Avisa em vez de gravar código inútil.
    const sci = pending.rows.filter((row) =>
      isScientificNotation(String(get(row, "code") ?? "")),
    ).length;
    if (sci > 0) {
      toast.warning(
        `${sci} código(s) vieram como "7,89E+12" e serão ignorados. Formate a coluna como Texto no Excel e importe de novo.`,
      );
    }
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
  // Um produto se repete por cliente/página; o NOME é propriedade do produto, não
  // da linha. Renomear/vincular sincroniza TODAS as páginas do mesmo produto
  // (mesmo productId; ou, se avulso, mesmo nome atual).
  // Identidade do produto entre linhas: id do cadastro → código → nome.
  // Sem código, é exatamente o critério anterior (nome).
  const sameProductAs = (ref: CatalogListItem) => (x: CatalogListItem) =>
    ref.productId
      ? x.productId === ref.productId
      : normalizeCode(ref.code)
        ? normalizeCode(x.code) === normalizeCode(ref.code)
        : x.productName === ref.productName;
  const renameProduct = (id: string, name: string) => {
    const ref = items.find((i) => i.id === id);
    if (!ref) return;
    const same = sameProductAs(ref);
    setItems(
      items.map((x) => (same(x) ? { ...x, productName: name } : x)),
      true,
    );
  };
  const pickProductForRow = (id: string, p: PickedProduct) => {
    const ref = items.find((i) => i.id === id);
    if (!ref) return;
    const same = sameProductAs(ref);
    setItems(
      items.map((x) => {
        if (!same(x)) return x;
        const next: CatalogListItem = {
          ...x,
          productName: p.name,
          productId: p.id,
          // Escolha explícita do usuário: some o selo "conferir".
          matchSource: "manual",
          thumbnail: p.thumbnail,
        };
        // Preço/departamento variam por loja — só preenche na linha editada.
        if (x.id === id) {
          if (x.normalPrice == null) next.normalPrice = p.salePrice;
          if (!x.department && p.categoryName) next.department = p.categoryName;
        }
        return next;
      }),
      true,
    );
  };
  // Apagar um ITEM DE LISTA: some da lista E de todas as páginas → some na
  // Página também. (Deleção simétrica Lista → Página.)
  const removeItem = (id: string) =>
    onConfigChange({
      ...(list
        ? { list: { ...list, items: items.filter((it) => it.id !== id) } }
        : {}),
      pages: pages.map((pg) =>
        pg.productIds
          ? { ...pg, productIds: pg.productIds.filter((pid) => pid !== id) }
          : pg,
      ),
    });
  // Apagar um produto do CADASTRO (linha "cadastro", não é item de lista): tira
  // de manuallyAddedIds, marca excluído e remove de todas as páginas.
  const removeManual = (id: string) =>
    onConfigChange({
      manuallyAddedIds: (config.manuallyAddedIds ?? []).filter((x) => x !== id),
      excludedProductIds: Array.from(
        new Set([...(config.excludedProductIds ?? []), id]),
      ),
      pages: pages.map((pg) =>
        pg.productIds
          ? { ...pg, productIds: pg.productIds.filter((pid) => pid !== id) }
          : pg,
      ),
    });
  // Reordena dentro da PÁGINA ativa (troca vizinhos em pages[].productIds).
  const canMoveItem = (id: string, dir: -1 | 1): boolean => {
    const ids = activePage?.productIds ?? [];
    const pos = ids.indexOf(id);
    return pos >= 0 && pos + dir >= 0 && pos + dir < ids.length;
  };
  const moveListItem = (id: string, dir: -1 | 1) => {
    if (!activePage) return;
    const ids = [...(activePage.productIds ?? [])];
    const pos = ids.indexOf(id);
    const target = pos + dir;
    if (pos < 0 || target < 0 || target >= ids.length) return;
    [ids[pos], ids[target]] = [ids[target], ids[pos]];
    onConfigChange({
      pages: pages.map((pg) =>
        pg.id === activePage.id ? { ...pg, productIds: ids } : pg,
      ),
    });
  };
  // "Adicionar linha": cria um item de lista E o coloca na PÁGINA ativa → aparece
  // na Página imediatamente. (Sincronização Lista → Página.)
  const addRow = () => {
    const gb = list?.groupBy ?? "client";
    const row: CatalogListItem = {
      id: uid(),
      client: activePage?.name?.trim() || "Sem cliente",
      productName: "",
    };
    if (activePage) {
      if (gb === "department") row.department = activePage.name;
      else if (gb === "custom") row.folder = activePage.name;
    }
    const targetId = activePage?.id ?? pages[0]?.id;
    setItems([...items, row], true);
    if (targetId)
      onConfigChange({
        pages: (config.pages ?? []).map((pg) =>
          pg.id === targetId
            ? { ...pg, productIds: [...(pg.productIds ?? []), row.id] }
            : pg,
        ),
      });
  };

  const groupBy = list?.groupBy ?? "client";

  // Grupos NOMEADOS da página ativa (divisores por grupo na Lista).
  const activeGroups = useMemo(
    () =>
      (activePage?.productGroups ?? []).filter(
        (g) => g.productIds !== undefined,
      ),
    [activePage],
  );

  // Ids a exibir: da PÁGINA ativa; ou de TODAS as páginas ("Todos"), sem repetir.
  const visibleIds = useMemo(() => {
    if (activeFolder) return activePage?.productIds ?? [];
    const seen = new Set<string>();
    const all: string[] = [];
    for (const pg of config.pages ?? [])
      for (const id of pg.productIds ?? [])
        if (!seen.has(id)) {
          seen.add(id);
          all.push(id);
        }
    return all;
  }, [activeFolder, activePage, config.pages]);

  // Linhas = productIds da página (na ordem), resolvidos para item de LISTA
  // (linha editável) ou produto do CADASTRO (linha "cadastro", leitura).
  // Divididas por grupo quando a página tem grupos nomeados.
  type Row = {
    id: string;
    item: CatalogListItem | undefined;
    product: CatalogProduct | undefined;
  };
  const groupedRows = useMemo<Row[]>(() => {
    const rows = visibleIds
      .map((id): Row | null => {
        const item = listItemById.get(id);
        if (item) return { id, item, product: undefined };
        const product = productById.get(id);
        return product ? { id, item: undefined, product } : null;
      })
      .filter((r): r is Row => r != null);
    if (activeGroups.length === 0) return rows;
    // Mesma regra do canvas e da aba "Página" (`sliceProductsByGroup`): antes
    // daqui a Lista casava por `productIds` cru, então um produto que o canvas
    // desenha dentro do grupo pela regra da sobra ficava sem divisória e ia
    // parar no fim da tabela.
    const dono = groupIdByProduct(
      activeGroups,
      rows.map((r) => ({ id: r.id })),
    );
    const ordem = new Map(activeGroups.map((g, i) => [g.id, i]));
    const rankOf = (id: string) => {
      const gid = dono.get(id);
      const i = gid ? (ordem.get(gid) ?? -1) : -1;
      return i < 0 ? Number.POSITIVE_INFINITY : i;
    };
    return [...rows].sort((a, b) => rankOf(a.id) - rankOf(b.id));
  }, [visibleIds, listItemById, productById, activeGroups]);
  // Move a linha para um grupo — mesma semântica do seletor da aba "Página":
  // entra no escolhido e SAI dos demais, senão apareceria em dois lugares.
  const setRowGroup = (rowId: string, groupId: string) => {
    const grupos = config.productGroups ?? [];
    if (grupos.length === 0) return;
    const comOId = grupos.map((g) =>
      g.id === groupId && g.productIds !== undefined
        ? { ...g, productIds: [...new Set([...g.productIds, rowId])] }
        : g,
    );
    onConfigChange({
      productGroups: groupId
        ? removeFromOtherGroups(comOId, [rowId], groupId)
        : grupos.map((g) =>
            g.productIds
              ? { ...g, productIds: g.productIds.filter((x) => x !== rowId) }
              : g,
          ),
    });
  };

  // Grupo que EXIBE cada linha — idem: mesma regra do canvas.
  const groupOwner = useMemo(
    () =>
      groupIdByProduct(
        activeGroups,
        visibleIds.map((id) => ({ id })),
      ),
    [activeGroups, visibleIds],
  );
  const groupNameOf = (id: string) => {
    const gid = groupOwner.get(id);
    if (!gid) return undefined;
    const i = activeGroups.findIndex((g) => g.id === gid);
    if (i < 0) return undefined;
    // Grupo sem nome ainda recebe rótulo — a divisória nunca some.
    return activeGroups[i].name?.trim() || `Grupo ${i + 1}`;
  };

  // ── Render: SEMPRE a tabela (vazia ou não) + modal de mapeamento ──
  let lastClient = "";
  let lastGroupId: string | undefined;
  const dividerColSpan =
    2 + TOGGLE_COLUMNS.filter((c) => showCol(c.key)).length;
  const mappingPreview = pending?.rows.slice(0, PREVIEW_ROWS) ?? [];

  // Wizard ocupa a área toda quando há linhas recém-importadas.
  if (wizardRows) {
    return (
      <div className="promo-panel flex h-full flex-col">
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
    <div className="promo-panel flex h-full flex-col">
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
            <strong>{unregisteredTargets.length}</strong> produto(s) distinto(s)
            — e vincular as linhas correspondentes. A ação altera o banco de
            produtos da sua organização.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRegister(false)}>
              Cancelar
            </Button>
            <Button onClick={registerProducts}>
              <PackagePlus className="mr-1 h-4 w-4" />
              Cadastrar {unregisteredTargets.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação do "Recasar produtos" (reescreve vínculo/foto das linhas) */}
      <Dialog
        open={!!recheckPlan}
        onOpenChange={(o) => !o && setRecheckPlan(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Recasar produtos</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <strong>{recheckPlan?.changed ?? 0}</strong> linha(s) mudariam de
            produto vinculado (e de foto). Linhas que você escolheu à mão são
            preservadas. Isso <strong>não</strong> altera o cadastro de produtos
            — só o vínculo desta lista.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setRecheckPlan(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (recheckPlan) setItems(recheckPlan.next, true);
                setRecheckPlan(null);
                toast.success("Vínculos atualizados.");
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Aplicar em {recheckPlan?.changed ?? 0}
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
            {new Set(pages.flatMap((pg) => pg.productIds ?? [])).size}{" "}
            produto(s) · {folders.length} página(s)
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
                <SelectItem value="none">Nenhum</SelectItem>
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
        {items.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            title="Reconferir o vínculo de cada linha com o cadastro (usa o código quando houver)"
            onClick={runRecheck}
          >
            {busy === "recheck" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Recasar produtos
          </Button>
        )}
        {unregisteredTargets.length > 0 && (
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
            Cadastrar novos ({unregisteredTargets.length})
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
                {showCol("code") && (
                  <TableHead className="w-32">Código</TableHead>
                )}
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
              {groupedRows.length === 0 && (
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
              {groupedRows.map((row) => {
                const it = row.item;
                const prod = row.product;
                const showClientDivider = it ? it.client !== lastClient : false;
                if (it) lastClient = it.client;
                // Divisor por GRUPO (nome do grupo + os produtos dele abaixo).
                // Mesma regra do canvas (`groupOwner`), não o `productIds` cru:
                // senão uma linha exibida no grupo pela regra da sobra abriria
                // um divisor "Sem grupo" no meio da tabela.
                const gId = groupOwner.get(row.id) ?? "__none__";
                const showGroupDivider =
                  activeGroups.length > 0 && gId !== lastGroupId;
                lastGroupId = gId;
                // Foto: snapshot da linha (lista) ou a foto do cadastro (manual).
                const thumbKey = it
                  ? it.thumbnail ||
                    (it.productId ? (dbThumbMap.get(it.productId) ?? "") : "")
                  : (prod?.thumbnail ?? "");
                const img = thumbKey ? constructUrl(thumbKey) : "";
                return (
                  <Fragment key={row.id}>
                    {showGroupDivider && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell
                          colSpan={dividerColSpan}
                          className="py-1 text-[13px] font-medium text-foreground"
                        >
                          {groupNameOf(row.id) || "Sem grupo"}
                        </TableCell>
                      </TableRow>
                    )}
                    {!it && prod ? (
                      <TableRow className="text-muted-foreground">
                        {showCol("image") && (
                          <TableCell className="p-1">
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded border bg-muted">
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
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="p-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm">
                              {prod.name}
                            </span>
                            <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                              cadastro
                            </span>
                          </div>
                        </TableCell>
                        {showCol("code") && (
                          <TableCell className="p-1 text-xs text-muted-foreground">
                            {prod.sku || ""}
                          </TableCell>
                        )}
                        {/* Preços do produto do CADASTRO editáveis aqui também:
                            grava override por-catálogo (priceOverrides /
                            offerOverrides) — NÃO altera o cadastro/ERP. Mesma
                            função usada na aba Produtos. */}
                        {showCol("normalPrice") && (
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={prod.salePrice ?? ""}
                              onChange={(e) =>
                                applyProductPrice(
                                  config,
                                  onConfigChange,
                                  prod.id,
                                  "normal",
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
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
                              value={prod.promotionalPrice ?? ""}
                              onChange={(e) =>
                                applyProductPrice(
                                  config,
                                  onConfigChange,
                                  prod.id,
                                  "offer",
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                              className="h-8"
                            />
                          </TableCell>
                        )}
                        {showCol("department") && (
                          <TableCell className="p-1 text-xs">
                            {prod.categoryName ?? ""}
                          </TableCell>
                        )}
                        {showCol("client") && <TableCell className="p-1" />}
                        <TableCell className="p-1">
                          <div className="flex items-center justify-end gap-1">
                            {/* Grupo da linha — o mesmo seletor da aba
                                "Página". Antes a Lista só mostrava a divisória,
                                sem como mudar o grupo sem sair da aba. */}
                            {activeGroups.length > 0 && (
                              <select
                                value={groupOwner.get(row.id) ?? ""}
                                onChange={(e) =>
                                  setRowGroup(row.id, e.target.value)
                                }
                                title="Grupo do produto"
                                className="h-7 max-w-[104px] rounded-md border bg-background px-1 text-[11px] text-muted-foreground"
                              >
                                <option value="">Sem grupo</option>
                                {activeGroups.map((g, i) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name?.trim() || `Grupo ${i + 1}`}
                                  </option>
                                ))}
                              </select>
                            )}
                            {prod && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                title="Remover da página"
                                onClick={() => removeManual(prod.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : it ? (
                      <TableRow>
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
                              onChange={(name) => renameProduct(it.id, name)}
                              onPick={(p) => pickProductForRow(it.id, p)}
                              className="h-8 flex-1"
                            />
                            <span
                              title={
                                !it.productId
                                  ? "Produto avulso (não está no cadastro)"
                                  : it.matchSource === "name-prefix"
                                    ? "Casado só pelo começo do nome — confira se a foto é deste produto"
                                    : "Vinculado a um produto do cadastro"
                              }
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                it.productId &&
                                  it.matchSource !== "name-prefix" &&
                                  "bg-green-500/15 text-green-700 dark:text-green-400",
                                it.productId &&
                                  it.matchSource === "name-prefix" &&
                                  "bg-orange-500/20 text-orange-700 dark:text-orange-400",
                                !it.productId &&
                                  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                              )}
                            >
                              {!it.productId
                                ? "novo"
                                : it.matchSource === "name-prefix"
                                  ? "conferir"
                                  : "cadastrado"}
                            </span>
                          </div>
                        </TableCell>
                        {showCol("code") && (
                          <TableCell className="p-1">
                            <Input
                              value={it.code ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  code: e.target.value.trim() || undefined,
                                })
                              }
                              placeholder="EAN"
                              className="h-8 text-xs"
                            />
                          </TableCell>
                        )}
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
                    ) : null}
                  </Fragment>
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
          {onAddPage && (
            <button
              type="button"
              onClick={onAddPage}
              title="Adicionar página"
              aria-label="Adicionar página"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
