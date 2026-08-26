"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackagePlus,
  Store as StoreIcon,
  ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadToR2 } from "@/lib/upload-to-r2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  useMatchProductsByName,
  useCreateOfferProducts,
  useMatchStoresByName,
} from "../hooks/use-catalog";
import { useCreateStore } from "@/features/stores/hooks/use-stores";
import {
  BACKGROUND_PRESETS,
  presetPreviewStyle,
} from "../lib/background-presets";
import type { CatalogConfig, CatalogListItem } from "../types";
import { itemFolderKey } from "../types";
import { matchKey, normalizeCode } from "../lib/product-match";

// Produto do cadastro casado com uma linha da planilha.
type ProdHit = {
  productId: string;
  thumbnail: string;
  source?: CatalogListItem["matchSource"];
};

type GroupBy = "client" | "department" | "custom";

// Campos de aparência do fundo que o wizard pode definir (preset, cor ou
// imagem). São espalhados no config ao concluir.
type WizardBackground = Partial<
  Pick<
    CatalogConfig,
    | "backgroundColor"
    | "backgroundGradient"
    | "backgroundOpacity"
    | "backgroundImage"
    | "backgroundFit"
    | "pageAspect"
    | "pageSize"
  >
>;

export interface WizardResult {
  items: CatalogListItem[];
  offerName: string;
  background: WizardBackground | null;
  maxPerPage: number;
  groupBy: GroupBy;
  folderNames: Record<string, string>;
  // Validade global "YYYY-MM-DDT23:59" (ou null) → config.offerValidUntil.
  offerValidUntil: string | null;
}

// Mede a imagem enviada: proporção exata + preset de tamanho mais próximo.
function measureBgImage(
  file: File,
): Promise<{ aspect: number; pageSize: CatalogConfig["pageSize"] } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const aspect = img.naturalWidth / img.naturalHeight;
      const opts: [CatalogConfig["pageSize"], number][] = [
        ["square", 1],
        ["portrait", 3 / 4],
        ["story", 9 / 16],
      ];
      let best = opts[0];
      let diff = Number.POSITIVE_INFINITY;
      for (const o of opts) {
        const d = Math.abs(aspect - o[1]);
        if (d < diff) {
          diff = d;
          best = o;
        }
      }
      resolve({ aspect, pageSize: best[0] });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// "YYYY-MM-DD" → "dd/mm/aaaa" (só exibição).
function fmtBr(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

interface CatalogListWizardProps {
  rows: CatalogListItem[]; // linhas recém-importadas (com ids)
  existingItems: CatalogListItem[]; // itens já na lista (append)
  catalogName: string;
  onApply: (result: WizardResult) => void;
  onCancel: () => void;
}

const STEPS = ["Produtos", "Lojas", "Nome + fundo", "Máx./página", "Pastas"];

export function CatalogListWizard({
  rows: initialRows,
  existingItems,
  catalogName,
  onApply,
  onCancel,
}: CatalogListWizardProps) {
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<CatalogListItem[]>(initialRows);

  // Produtos
  const matchProducts = useMatchProductsByName();
  const createProducts = useCreateOfferProducts();
  const [prodMatch, setProdMatch] = useState<Map<string, ProdHit | null>>(
    new Map(),
  );
  const [createProd, setCreateProd] = useState<Set<string>>(new Set());
  const [prodLoading, setProdLoading] = useState(true);

  // Lojas
  const matchStores = useMatchStoresByName();
  const createStore = useCreateStore();
  const [storeMatch, setStoreMatch] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [createSt, setCreateSt] = useState<Set<string>>(new Set());
  const [storeLoading, setStoreLoading] = useState(true);

  // Settings
  const [offerName, setOfferName] = useState(catalogName || "Ofertas");
  // Fundo: um preset, uma cor sólida ou uma imagem enviada (mutuamente exclus.).
  const [bgKind, setBgKind] = useState<"preset" | "color" | "image" | null>(
    null,
  );
  const [bgId, setBgId] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState<{
    key: string;
    aspect: number;
    pageSize: CatalogConfig["pageSize"];
  } | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("client");
  const [folderNames, setFolderNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Validade detectada: menor início e maior fim entre as linhas importadas.
  const detected = useMemo(() => {
    const starts = initialRows
      .map((r) => r.startDate)
      .filter((d): d is string => !!d)
      .sort();
    const ends = initialRows
      .map((r) => r.endDate)
      .filter((d): d is string => !!d)
      .sort();
    return { start: starts[0], end: ends[ends.length - 1] };
  }, [initialRows]);
  // Input <date> guarda "YYYY-MM-DD"; vira "…T23:59" no resultado.
  const [validUntil, setValidUntil] = useState(detected.end ?? "");

  // Produtos distintos da planilha. A identidade é o `matchKey`: com a coluna
  // "Código", é o código; sem ela, é o nome — igual ao comportamento anterior.
  const uniqueTargets = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code?: string }>();
    for (const r of rows) {
      if (!r.productName) continue;
      const key = matchKey(r);
      if (!map.has(key))
        map.set(key, { key, name: r.productName, code: r.code || undefined });
    }
    return [...map.values()];
  }, [rows]);
  const uniqueClients = useMemo(
    () => [...new Set(rows.map((r) => r.client).filter(Boolean))],
    [rows],
  );

  // Casar produtos + lojas ao montar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só na montagem
  useEffect(() => {
    (async () => {
      try {
        const res = await matchProducts.mutateAsync({
          items: uniqueTargets.map((t) => ({ name: t.name, code: t.code })),
        });
        const m = new Map<string, ProdHit | null>();
        for (const r of res)
          m.set(
            matchKey({ productName: r.name, code: r.code }),
            r.productId
              ? {
                  productId: r.productId,
                  thumbnail: r.thumbnail ?? "",
                  source: r.source ?? undefined,
                }
              : null,
          );
        setProdMatch(m);
        // Aplica os já encontrados nas linhas (imagem/productId).
        setRows((prev) =>
          prev.map((it) => {
            const hit = m.get(matchKey(it));
            return hit
              ? {
                  ...it,
                  productId: hit.productId,
                  thumbnail: hit.thumbnail,
                  ...(hit.source ? { matchSource: hit.source } : {}),
                }
              : it;
          }),
        );
      } catch {
        toast.error("Falha ao casar produtos.");
      } finally {
        setProdLoading(false);
      }
      try {
        const res = await matchStores.mutateAsync({ names: uniqueClients });
        const m = new Map<string, string | null>();
        for (const r of res) m.set(r.name, r.storeId);
        setStoreMatch(m);
      } catch {
        // sem loja é ok
      } finally {
        setStoreLoading(false);
      }
    })();
  }, []);

  const newTargets = uniqueTargets.filter((t) => !prodMatch.get(t.key));
  const newClients = uniqueClients.filter((c) => !storeMatch.get(c));

  const maxPerClientCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = itemFolderKey(r, "client");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Math.max(1, ...(counts.size ? [...counts.values()] : [1]));
  }, [rows]);
  const [maxPerPage, setMaxPerPage] = useState(maxPerClientCount);
  useEffect(() => setMaxPerPage(maxPerClientCount), [maxPerClientCount]);

  // Pastas conforme groupBy (para o passo 5 e para renomear).
  const folders = useMemo(() => {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = itemFolderKey(r, groupBy);
      if (!counts.has(k)) order.push(k);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return order.map((k) => ({ key: k, count: counts.get(k) ?? 0 }));
  }, [rows, groupBy]);

  // ── Avançar (com efeitos por passo) ──
  const next = async () => {
    if (step === 0) {
      // Cria os produtos marcados como novos.
      const toCreate = newTargets.filter((t) => createProd.has(t.key));
      if (toCreate.length > 0) {
        setBusy(true);
        try {
          const payload = toCreate.map((t) => {
            const row = rows.find((r) => matchKey(r) === t.key);
            return {
              name: t.name,
              salePrice: row?.normalPrice ?? row?.offerPrice ?? 0,
              // `@@unique([organizationId, barcode])`: só código aproveitável.
              ...(normalizeCode(t.code)
                ? { barcode: normalizeCode(t.code) }
                : {}),
            };
          });
          const res = await createProducts.mutateAsync({ products: payload });
          const byKey = new Map<string, string>();
          res.forEach((r, i) => {
            if (r.productId) byKey.set(toCreate[i].key, r.productId);
          });
          setRows((prev) =>
            prev.map((it) => {
              const pid = byKey.get(matchKey(it));
              return pid
                ? { ...it, productId: pid, matchSource: "manual" as const }
                : it;
            }),
          );
          // Marca como "no cadastro" p/ sair da lista de novos — evita recriar
          // ao voltar e avançar de novo.
          setProdMatch((prev) => {
            const m = new Map(prev);
            for (const [key, pid] of byKey)
              m.set(key, {
                productId: pid,
                thumbnail: m.get(key)?.thumbnail ?? "",
                source: "manual",
              });
            return m;
          });
          setCreateProd((prev) => {
            const n = new Set(prev);
            for (const key of byKey.keys()) n.delete(key);
            return n;
          });
          toast.success(`${byKey.size} produto(s) criado(s) no cadastro.`);
        } catch {
          toast.error("Falha ao criar produtos.");
        } finally {
          setBusy(false);
        }
      }
    } else if (step === 1) {
      const toCreate = newClients.filter((c) => createSt.has(c));
      if (toCreate.length > 0) {
        setBusy(true);
        let created = 0;
        for (const name of toCreate) {
          try {
            const st = (await createStore.mutateAsync({ name })) as {
              id?: string;
            } | null;
            created++;
            // Marca como "cadastrada" p/ não recriar ao voltar e avançar.
            setStoreMatch((prev) => new Map(prev).set(name, st?.id ?? name));
            setCreateSt((prev) => {
              const n = new Set(prev);
              n.delete(name);
              return n;
            });
          } catch {
            // ex.: sem permissão canManageStores — ignora e segue
          }
        }
        setBusy(false);
        if (created > 0) toast.success(`${created} loja(s) cadastrada(s).`);
        else if (toCreate.length > 0)
          toast.error("Não foi possível cadastrar lojas (permissão?).");
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  // Fundo escolhido (preset / cor / imagem). Zera os campos concorrentes para
  // não sobrar imagem quando escolhe cor, etc.
  const currentBackground = (): WizardBackground | null => {
    if (bgKind === "image" && bgImage)
      return {
        backgroundImage: bgImage.key,
        backgroundFit: "cover",
        pageAspect: bgImage.aspect,
        pageSize: bgImage.pageSize,
        backgroundGradient: undefined,
      };
    if (bgKind === "color")
      return {
        backgroundColor: customColor,
        backgroundGradient: undefined,
        backgroundImage: "",
        pageAspect: undefined,
      };
    if (bgKind === "preset" && bgId) {
      const p = BACKGROUND_PRESETS.find((x) => x.id === bgId);
      return p ? { ...p.bg, backgroundImage: "", pageAspect: undefined } : null;
    }
    return null;
  };

  const handleUploadBg = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingBg(true);
    try {
      const [key, measured] = await Promise.all([
        uploadToR2(file, true),
        measureBgImage(file),
      ]);
      setBgImage({
        key,
        aspect: measured?.aspect ?? 1,
        pageSize: measured?.pageSize ?? "square",
      });
      setBgKind("image");
    } catch {
      toast.error("Falha ao enviar a imagem de fundo.");
    } finally {
      setUploadingBg(false);
    }
  };

  const finish = () => {
    onApply({
      items: [...existingItems, ...rows],
      offerName: offerName.trim() || "Ofertas",
      background: currentBackground(),
      maxPerPage,
      groupBy,
      folderNames,
      offerValidUntil: validUntil ? `${validUntil}T23:59` : null,
    });
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      {/* Progresso */}
      <div className="mb-4 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-2 border-primary text-primary"
                    : "border text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "truncate text-xs",
                i === step ? "font-medium" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border p-4">
        {/* Passo 1: Produtos */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <PackagePlus className="h-4 w-4 text-primary" />
              <span className="font-medium">Produtos</span>
              {prodLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-muted-foreground">
                  {uniqueTargets.length - newTargets.length} encontrados ·{" "}
                  {newTargets.length} novos
                </span>
              )}
              {!prodLoading && newTargets.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1 text-xs"
                  onClick={() =>
                    setCreateProd((prev) =>
                      newTargets.every((t) => prev.has(t.key))
                        ? new Set()
                        : new Set(newTargets.map((t) => t.key)),
                    )
                  }
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {newTargets.every((t) => createProd.has(t.key))
                    ? "Limpar seleção"
                    : "Selecionar todos"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Marque os produtos NOVOS que quer criar no cadastro (nome +
              preço). Os não marcados aparecem como Etiqueta avulsa.
            </p>
            <div className="flex flex-col divide-y rounded-md border">
              {uniqueTargets.map(({ key, name, code }) => {
                const hit = prodMatch.get(key);
                const needsCheck = hit?.source === "name-prefix";
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm"
                  >
                    {hit ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                        {hit.thumbnail ? (
                          // biome-ignore lint/performance/noImgElement: prévia
                          <img
                            src={constructUrl(hit.thumbnail)}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </span>
                    ) : (
                      <Checkbox
                        checked={createProd.has(key)}
                        onCheckedChange={(v) =>
                          setCreateProd((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(key);
                            else n.delete(key);
                            return n;
                          })
                        }
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      {code && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {code}
                        </span>
                      )}
                    </span>
                    <span
                      title={
                        needsCheck
                          ? "Casado só pelo começo do nome — confira a foto depois"
                          : undefined
                      }
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        hit &&
                          !needsCheck &&
                          "bg-green-500/15 text-green-700 dark:text-green-400",
                        needsCheck &&
                          "bg-orange-500/20 text-orange-700 dark:text-orange-400",
                        !hit &&
                          "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {!hit ? "novo" : needsCheck ? "conferir" : "no cadastro"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Passo 2: Lojas */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <StoreIcon className="h-4 w-4 text-primary" />
              <span className="font-medium">Lojas (clientes)</span>
              {storeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-muted-foreground">
                  {uniqueClients.length - newClients.length} encontradas ·{" "}
                  {newClients.length} novas
                </span>
              )}
              {!storeLoading && newClients.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1 text-xs"
                  onClick={() =>
                    setCreateSt((prev) =>
                      newClients.every((c) => prev.has(c))
                        ? new Set()
                        : new Set(newClients),
                    )
                  }
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {newClients.every((c) => createSt.has(c))
                    ? "Limpar seleção"
                    : "Selecionar todas"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Marque as lojas NOVAS para cadastrar no banco (precisa de
              permissão de lojas). As não marcadas viram só o nome da página.
            </p>
            <div className="flex flex-col divide-y rounded-md border">
              {uniqueClients.map((c) => {
                const exists = !!storeMatch.get(c);
                return (
                  <div
                    key={c}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm"
                  >
                    {exists ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Checkbox
                        checked={createSt.has(c)}
                        onCheckedChange={(v) =>
                          setCreateSt((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(c);
                            else n.delete(c);
                            return n;
                          })
                        }
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{c}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        exists
                          ? "bg-green-500/15 text-green-700 dark:text-green-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {exists ? "cadastrada" : "nova"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Passo 3: Nome + fundo */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nome da oferta</Label>
              <Input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="Ex.: Encarte de Agosto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Validade da oferta (fim)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-44"
                />
                <span className="text-[11px] text-muted-foreground">
                  Período detectado na planilha: {fmtBr(detected.start)} a{" "}
                  {fmtBr(detected.end)}. Confira — datas erradas comprometem a
                  oferta.
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Fundo</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {BACKGROUND_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name}
                    onClick={() => {
                      if (bgKind === "preset" && bgId === p.id) {
                        setBgKind(null);
                        setBgId(null);
                      } else {
                        setBgKind("preset");
                        setBgId(p.id);
                      }
                    }}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-end overflow-hidden rounded-md border-2 p-1 text-[9px] transition-colors",
                      bgKind === "preset" && bgId === p.id
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50",
                    )}
                    style={presetPreviewStyle(p)}
                  >
                    <span className="rounded bg-black/40 px-1 text-white">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Cor sólida + enviar imagem (como em Propriedades do fundo) */}
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleUploadBg(file);
                }}
              />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border-2 px-2 py-1 text-xs transition-colors",
                    bgKind === "color"
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: customColor }}
                  />
                  Cor sólida
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setBgKind("color");
                    }}
                    className="h-6 w-8 cursor-pointer rounded border p-0"
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  disabled={uploadingBg}
                  onClick={() => bgInputRef.current?.click()}
                >
                  {uploadingBg ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Enviar imagem de fundo
                </Button>

                {bgKind === "image" && bgImage && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center overflow-hidden rounded border-2",
                        "border-primary ring-2 ring-primary/40",
                      )}
                    >
                      {/* biome-ignore lint/performance/noImgElement: prévia */}
                      <img
                        src={constructUrl(bgImage.key)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title="Remover imagem de fundo"
                      onClick={() => {
                        setBgImage(null);
                        setBgKind(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Escolha um preset, uma cor sólida ou envie uma imagem — a página
                assume a proporção da imagem (preenche sem cortar). Opcional: dá
                para ajustar depois na aba Layout.
              </p>
            </div>
          </div>
        )}

        {/* Passo 4: Máx./página */}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <Label className="text-xs">Máximo de produtos por página</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={24}
                value={maxPerPage}
                onChange={(e) =>
                  setMaxPerPage(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">
                Sugerido pelo maior cliente: {maxPerClientCount}. Define a grade
                (3 colunas × {Math.ceil(maxPerPage / 3)} linhas).
              </span>
            </div>
          </div>
        )}

        {/* Passo 5: Pastas */}
        {step === 4 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Agrupar pastas (páginas) por</Label>
              <Select
                value={groupBy}
                onValueChange={(v) => setGroupBy(v as GroupBy)}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="department">Departamento</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada pasta vira uma página. Renomeie se quiser.
            </p>
            <div className="flex flex-col gap-1.5">
              {folders.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <Input
                    value={folderNames[f.key] ?? f.key}
                    onChange={(e) =>
                      setFolderNames((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                    className="h-8 flex-1 text-sm"
                  />
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {f.count} produto(s)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="mt-3 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          disabled={busy}
        >
          {step === 0 ? (
            "Cancelar"
          ) : (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </>
          )}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Avançar <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={busy}>
            Concluir e gerar
          </Button>
        )}
      </div>
    </div>
  );
}
