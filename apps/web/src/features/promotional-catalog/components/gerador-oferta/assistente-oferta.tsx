"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ImageOff,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { useBrands } from "@/features/brands/hooks/use-brands";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency-formatter";
import {
  CLIMAS_OFERTA,
  type ClimaOferta,
  type EntradaOferta,
  FORMATOS_OFERTA,
  type FormatoOferta,
  LIMITE_POR_PAGINA,
  type MoldeOferta,
  paletaDoClima,
} from "../../lib/compor-oferta";
import { NIVEIS_OFERTA, type NivelOferta } from "../../lib/oferta-desenhada";
import {
  useOfferAiEstimate,
  useOfferGenerate,
  useOfferGeneration,
  useOfferLogoGenerate,
  usePriceStyles,
} from "../../hooks/use-catalog";
import { PROPORCAO_DO_CARD_PADRAO } from "../../etiqueta-padrao";
import { PriceStyleThumb, styleToLayout } from "../config-panel";
import { ColorSwatch } from "../panel-ui";

const PASSOS = ["Formato", "Produtos", "Oferta", "Marca e estilo", "Gerar"];

const INFOS_PRONTAS = [
  "Enquanto durar o estoque",
  "Imagens meramente ilustrativas",
  "Consulte condições na loja",
];

type Logo = "org" | "marca" | "upload" | "ia" | "nenhum";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dentro de um catálogo aberto o formato é o dele (o passo só confirma). */
  formatoFixo?: FormatoOferta;
  gerando?: boolean;
  /** Compõe no cliente: sem IA, ou com a IA dentro de um catálogo aberto. */
  onGerar: (entrada: EntradaOferta, nome: string) => void;
  /** Catálogo aberto — a IA devolve os parâmetros e o editor compõe. */
  catalogId?: string;
  /** Sem catálogo aberto, a IA já cria o catálogo; aqui se abre ele. */
  aoCriarCatalogo?: (id: string) => void;
  /** Proporção do card do catálogo aberto — a etiqueta salva é desenhada nela. */
  proporcaoCard?: number;
};

/**
 * Gerador de oferta: produtos + oferta + marca + estilo → páginas prontas.
 * Esta tela só junta os dados; quem desenha é `comporOferta` — e o resultado
 * é um catálogo comum, editável depois.
 */
export function AssistenteOferta({
  open,
  onOpenChange,
  formatoFixo,
  gerando,
  onGerar,
  catalogId,
  aoCriarCatalogo,
  proporcaoCard,
}: Props) {
  const [passo, setPasso] = useState(0);
  const [formato, setFormato] = useState<FormatoOferta>(formatoFixo ?? "story");
  const [ids, setIds] = useState<string[]>([]);
  const [precosPor, setPrecosPor] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [chamada, setChamada] = useState("");
  const [validade, setValidade] = useState("");
  const [infos, setInfos] = useState<string[]>([INFOS_PRONTAS[0]]);
  const [infoLivre, setInfoLivre] = useState("");
  const [contato, setContato] = useState("");
  const [logo, setLogo] = useState<Logo>("org");
  const [marcaId, setMarcaId] = useState("");
  const [logoEnviado, setLogoEnviado] = useState<string | null>(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [clima, setClima] = useState<ClimaOferta>("impacto");
  const [corBase, setCorBase] = useState(CLIMAS_OFERTA[0].corPadrao);
  const [molde, setMolde] = useState<MoldeOferta>("grade");
  // "SEM" = compositor puro, grátis. Os níveis chamam a IA e cobram ★.
  const [nivel, setNivel] = useState<NivelOferta | "SEM" | null>(null);
  const [estiloLivre, setEstiloLivre] = useState(false);
  const [salvarPadrao, setSalvarPadrao] = useState(false);
  // A arte premium é o que faz a oferta parecer peça de designer — nasce
  // ligada; desligar volta ao molde montado (mais barato e instantâneo).
  const [arteIa, setArteIa] = useState(true);
  const [geracaoId, setGeracaoId] = useState<string | null>(null);
  const [logoDaIa, setLogoDaIa] = useState<string | null>(null);
  const [nivelDoLogo, setNivelDoLogo] = useState<NivelOferta | null>(null);
  const [pedidoDoLogo, setPedidoDoLogo] = useState("");
  const criarLogo = useOfferLogoGenerate();
  const { data: etiquetasSalvas } = usePriceStyles();
  const etiquetas = useMemo(
    () => [
      ...(etiquetasSalvas?.mine ?? []),
      ...(etiquetasSalvas?.system ?? []),
    ],
    [etiquetasSalvas],
  );
  // `undefined` = ainda não escolheu: vale a etiqueta mais recente da
  // organização (é o padrão de preço que ela já usa). `null` = automática.
  const [etiquetaId, setEtiquetaId] = useState<string | null | undefined>();
  const etiquetaEscolhida =
    etiquetaId === undefined
      ? (etiquetasSalvas?.mine[0]?.id ?? null)
      : etiquetaId;
  const proporcaoDaEtiqueta = proporcaoCard ?? PROPORCAO_DO_CARD_PADRAO;
  const logoInput = useRef<HTMLInputElement>(null);

  const formatoEfetivo = formatoFixo ?? formato;
  const { brands } = useBrands();
  const marcasComLogo = brands.filter((b) => b.logo);

  const [busca, setBusca] = useState("");
  const termo = useDeferredValue(busca.trim());
  const resultados = useQuery(
    orpc.promotionalCatalog.searchProducts.queryOptions({
      input: { q: termo, limit: 12 },
      enabled: termo.length >= 2,
    }),
  );
  const [verPromocoes, setVerPromocoes] = useState(false);
  const emPromocao = useQuery(
    orpc.promotionalCatalog.listProducts.queryOptions({
      input: { autoPromotions: true },
      enabled: open && verPromocoes,
    }),
  );
  // A conferência precisa do preço de promoção e do estoque, que a busca não
  // traz — então os escolhidos são relidos pelo mesmo resolvedor do catálogo.
  const conferencia = useQuery(
    orpc.promotionalCatalog.listProducts.queryOptions({
      input: { manuallyAddedIds: ids },
      enabled: open && ids.length > 0,
    }),
  );
  const porId = useMemo(
    () => new Map((conferencia.data ?? []).map((p) => [p.id, p])),
    [conferencia.data],
  );

  const adicionar = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const tirar = (id: string) => setIds((prev) => prev.filter((x) => x !== id));
  const mover = (i: number, d: -1 | 1) =>
    setIds((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const escolhidos = ids.map((id) => porId.get(id)).filter((p) => !!p);
  const semPreco = escolhidos.filter((p) => {
    const por = Number(precosPor[p.id]);
    const preco = por > 0 ? por : (p.promotionalPrice ?? p.salePrice);
    return !(preco > 0);
  }).length;
  const semFoto = escolhidos.filter((p) => !p.thumbnail).length;
  const limite = LIMITE_POR_PAGINA[formatoEfetivo];
  const paginas = Math.max(1, Math.ceil(ids.length / limite));

  const estimativa = useOfferAiEstimate(ids.length, open && passo >= 3);
  const iaNoAr = estimativa.data?.disponivel ?? false;
  // Nível inicial = o padrão da organização, quando há IA; senão, sem IA.
  const nivelEfetivo: NivelOferta | "SEM" =
    nivel ?? (iaNoAr ? (estimativa.data?.nivelPadrao ?? "SEM") : "SEM");
  const pedirGeracao = useOfferGenerate();
  const geracao = useOfferGeneration(geracaoId);
  const trabalhando =
    pedirGeracao.isPending ||
    (!!geracaoId &&
      geracao.data?.status !== "DONE" &&
      geracao.data?.status !== "FAILED");

  const onGerarRef = useRef(onGerar);
  onGerarRef.current = onGerar;
  const aoCriarRef = useRef(aoCriarCatalogo);
  aoCriarRef.current = aoCriarCatalogo;
  useEffect(() => {
    const g = geracao.data;
    if (!geracaoId || !g) return;
    if (g.status === "FAILED") {
      toast.error(g.erro ? `A IA não conseguiu: ${g.erro}` : "A IA falhou");
      setGeracaoId(null);
    } else if (g.status === "DONE" && g.resultado) {
      setGeracaoId(null);
      if (g.starsCobradas > 0)
        toast.success(`Oferta gerada — ${g.starsCobradas} ★`);
      if (g.resultado.catalogoCriado)
        aoCriarRef.current?.(g.resultado.catalogoCriado);
      else onGerarRef.current(g.resultado.entrada, nome.trim());
    }
  }, [geracao.data, geracaoId, nome]);

  const logoDaEntrada = (): EntradaOferta["logo"] => {
    if (logo === "org") return { tipo: "org" };
    if (logo === "marca") {
      const m = marcasComLogo.find((b) => b.id === marcaId);
      return m?.logo ? { tipo: "asset", chave: m.logo } : null;
    }
    if (logo === "upload" && logoEnviado)
      return { tipo: "asset", chave: logoEnviado };
    if (logo === "ia" && logoDaIa) return { tipo: "asset", chave: logoDaIa };
    return null;
  };

  const podeAvancar =
    passo === 1 ? ids.length > 0 : passo === 2 ? nome.trim().length > 0 : true;

  const gerar = () => {
    const precos = Object.fromEntries(
      Object.entries(precosPor)
        .map(([id, v]) => [id, Number(v.replace(",", "."))] as const)
        .filter(([, v]) => Number.isFinite(v) && v > 0),
    );
    const entrada: EntradaOferta = {
      formato: formatoEfetivo,
      produtoIds: ids,
      precosPor: precos,
      oferta: {
        nome: nome.trim(),
        chamada: chamada.trim() || undefined,
        validade: validade || undefined,
        informacoes: [...infos, infoLivre.trim()].filter(Boolean),
        contato: contato.trim() || undefined,
      },
      logo: logoDaEntrada(),
      clima,
      corBase,
      molde,
      ...(etiquetaEscolhida
        ? {
            etiqueta: {
              layout: styleToLayout(
                etiquetas.find((e) => e.id === etiquetaEscolhida)?.style,
              ),
              proporcao: proporcaoDaEtiqueta,
            },
          }
        : {}),
    };
    if (nivelEfetivo === "SEM") {
      onGerar(entrada, nome.trim());
      return;
    }
    // A etiqueta vai só pelo id: o servidor relê e confere a organização.
    const { etiqueta: _soNoCliente, ...semEtiqueta } = entrada;
    pedirGeracao.mutate(
      {
        nome: nome.trim(),
        nivel: nivelEfetivo,
        estiloLivre,
        salvarNivelComoPadrao: salvarPadrao,
        catalogId,
        pedido: {
          ...semEtiqueta,
          etiquetaId: etiquetaEscolhida ?? undefined,
          arteIa,
        },
      },
      { onSuccess: (d) => setGeracaoId(d.id) },
    );
  };

  const enviarLogo = async (file: File) => {
    setEnviandoLogo(true);
    try {
      setLogoEnviado(await uploadToR2(file, true));
      setLogo("upload");
    } catch {
      toast.error("Falha ao enviar o logo");
    } finally {
      setEnviandoLogo(false);
    }
  };

  const paleta = paletaDoClima(clima, corBase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,90vh)] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Gerar oferta
          </DialogTitle>
          <DialogDescription>
            Escolha os produtos e o estilo — a página sai montada e continua
            editável.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-1 text-[11px]">
          {PASSOS.map((rotulo, i) => (
            <li key={rotulo} className="flex-1">
              <button
                type="button"
                disabled={i > passo && !podeAvancar}
                onClick={() => i <= passo && setPasso(i)}
                className={cn(
                  "flex w-full flex-col gap-1 text-left",
                  i > passo && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "h-1 rounded-full",
                    i <= passo ? "bg-primary" : "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    i === passo
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {i + 1}. {rotulo}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="flex min-h-0 flex-1 flex-col">
          {passo === 0 && (
            <div className="flex flex-col gap-3">
              <Label>Escolha um formato</Label>
              <div className="grid grid-cols-3 gap-3">
                {FORMATOS_OFERTA.map((f) => {
                  const ativo = formatoEfetivo === f.value;
                  const travado = !!formatoFixo && !ativo;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      disabled={travado}
                      onClick={() => setFormato(f.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                        ativo
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/40 hover:bg-muted",
                        travado && "opacity-40",
                      )}
                    >
                      <span
                        className="rounded-sm border-2 border-foreground/60 bg-background"
                        style={{
                          width: f.value === "story" ? 36 : 48,
                          height:
                            f.value === "story"
                              ? 64
                              : f.value === "feed"
                                ? 60
                                : 68,
                        }}
                      />
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.detalhe} · até {LIMITE_POR_PAGINA[f.value]} por
                        página
                      </span>
                    </button>
                  );
                })}
              </div>
              {formatoFixo && (
                <p className="text-xs text-muted-foreground">
                  O formato é o do catálogo aberto — as páginas da oferta entram
                  nele.
                </p>
              )}
            </div>
          )}

          {passo === 1 && (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto pelo nome…"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button
                  variant={verPromocoes ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setVerPromocoes((v) => !v)}
                >
                  <Tag className="size-4" />
                  {verPromocoes ? "Esconder" : "Ver"} os que estão em promoção
                </Button>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  {(verPromocoes && !termo
                    ? (emPromocao.data ?? []).map((p) => ({
                        id: p.id,
                        name: p.name,
                        thumbnail: p.thumbnail,
                        preco: p.promotionalPrice ?? p.salePrice,
                      }))
                    : (resultados.data ?? []).map((p) => ({
                        id: p.id,
                        name: p.name,
                        thumbnail: p.thumbnail,
                        preco: p.salePrice,
                      }))
                  ).map((p) => {
                    const dentro = ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => (dentro ? tirar(p.id) : adicionar(p.id))}
                        className="flex w-full items-center gap-2 border-b px-2 py-1.5 text-left text-sm last:border-b-0 hover:bg-muted/50"
                      >
                        <Miniatura chave={p.thumbnail} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatBRL(p.preco)}
                        </span>
                        {dentro ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <Plus className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                  {(resultados.isFetching || emPromocao.isFetching) && (
                    <div className="flex justify-center p-3">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!termo && !verPromocoes && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Digite ao menos 2 letras ou veja os produtos em promoção.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label>Conferência ({ids.length})</Label>
                  <span className="text-xs text-muted-foreground">
                    {paginas} página(s) · até {limite} por página
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  {ids.length === 0 && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Os produtos escolhidos aparecem aqui, com o preço para
                      conferir.
                    </p>
                  )}
                  {ids.map((id, i) => {
                    const p = porId.get(id);
                    const de = p?.salePrice ?? 0;
                    const porPadrao = p?.promotionalPrice ?? null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 border-b px-2 py-1.5 text-sm last:border-b-0"
                      >
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label="Subir"
                            onClick={() => mover(i, -1)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Descer"
                            onClick={() => mover(i, 1)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                        <Miniatura chave={p?.thumbnail ?? ""} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{p?.name ?? "…"}</span>
                          <span className="text-[11px] text-muted-foreground">
                            De {formatBRL(de)}
                            {p && ` · estoque ${p.currentStock}`}
                          </span>
                        </div>
                        <Input
                          inputMode="decimal"
                          aria-label="Preço Por"
                          className="h-8 w-24 text-right tabular-nums"
                          placeholder={
                            porPadrao != null ? String(porPadrao) : "Por"
                          }
                          value={precosPor[id] ?? ""}
                          onChange={(e) =>
                            setPrecosPor((prev) => ({
                              ...prev,
                              [id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          aria-label="Tirar da oferta"
                          onClick={() => tirar(id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {(semPreco > 0 || semFoto > 0) && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="size-3.5" />
                    {semPreco > 0 && `${semPreco} sem preço`}
                    {semPreco > 0 && semFoto > 0 && " · "}
                    {semFoto > 0 && `${semFoto} sem foto`}
                  </p>
                )}
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="oferta-nome">Nome da oferta</Label>
                <Input
                  id="oferta-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Rasga Outubro"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oferta-chamada">Chamada (opcional)</Label>
                <Input
                  id="oferta-chamada"
                  value={chamada}
                  onChange={(e) => setChamada(e.target.value)}
                  placeholder="Ex.: Preços que rasgam a etiqueta"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oferta-validade">Validade</Label>
                <Input
                  id="oferta-validade"
                  type="datetime-local"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oferta-contato">Contato (opcional)</Label>
                <Input
                  id="oferta-contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Ex.: WhatsApp (85) 99999-0000"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Informações</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {INFOS_PRONTAS.map((info) => (
                    <label
                      key={info}
                      htmlFor={`info-${info}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`info-${info}`}
                        checked={infos.includes(info)}
                        onCheckedChange={(v) =>
                          setInfos((prev) =>
                            v
                              ? [...prev, info]
                              : prev.filter((x) => x !== info),
                          )
                        }
                      />
                      {info}
                    </label>
                  ))}
                </div>
                <Input
                  value={infoLivre}
                  onChange={(e) => setInfoLivre(e.target.value)}
                  placeholder="Outra informação (opcional)"
                />
              </div>
            </div>
          )}

          {passo === 3 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Logo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["org", "Da empresa", Building2],
                      ["marca", "Marca cadastrada", Tag],
                      ["upload", "Enviar logo", Upload],
                      ["nenhum", "Sem logo", X],
                      ["ia", "Criar com IA", Sparkles],
                    ] as const
                  ).map(([valor, rotulo, Icone]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() =>
                        valor === "upload" && !logoEnviado
                          ? logoInput.current?.click()
                          : setLogo(valor)
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm",
                        logo === valor
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/40 hover:bg-muted",
                        valor === "ia" && "col-span-2",
                      )}
                    >
                      {valor === "upload" && enviandoLogo ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Icone className="size-4" />
                      )}
                      {rotulo}
                    </button>
                  ))}
                </div>
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) enviarLogo(file);
                  }}
                />
                {logo === "marca" && (
                  <Select value={marcaId} onValueChange={setMarcaId}>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          marcasComLogo.length > 0
                            ? "Escolha a marca"
                            : "Nenhuma marca com logo"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {marcasComLogo.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {logo === "upload" && logoEnviado && (
                  <div className="flex items-center gap-2">
                    <Miniatura chave={logoEnviado} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => logoInput.current?.click()}
                    >
                      Trocar
                    </Button>
                  </div>
                )}

                {logo === "ia" && (
                  <LogoPorIa
                    disponivel={estimativa.data?.logoDisponivel ?? false}
                    precos={estimativa.data?.logo}
                    nivel={
                      nivelDoLogo ??
                      estimativa.data?.nivelPadrao ??
                      "EQUILIBRADO"
                    }
                    onNivel={setNivelDoLogo}
                    pedido={pedidoDoLogo}
                    onPedido={setPedidoDoLogo}
                    chave={logoDaIa}
                    gerando={criarLogo.isPending}
                    semNome={!nome.trim()}
                    onGerar={(n) =>
                      criarLogo.mutate(
                        {
                          nome: nome.trim(),
                          nivel: n,
                          clima,
                          corBase: /^#[0-9a-f]{6}$/i.test(corBase)
                            ? corBase
                            : undefined,
                          instrucoes: pedidoDoLogo.trim() || undefined,
                        },
                        {
                          onSuccess: (d) => {
                            setLogoDaIa(d.chave);
                            if (d.starsCobradas > 0)
                              toast.success(
                                `Logo criado — ${d.starsCobradas} ★`,
                              );
                          },
                        },
                      )
                    }
                  />
                )}

                <Label className="mt-2">Etiqueta de preço</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setEtiquetaId(null)}
                    className={cn(
                      "flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 p-1 text-[10px]",
                      etiquetaEscolhida === null
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/40 hover:bg-muted",
                    )}
                    style={{ aspectRatio: String(proporcaoDaEtiqueta) }}
                  >
                    <Sparkles className="size-4 text-primary" />
                    Automática
                  </button>
                  {etiquetas.map((et) => (
                    <button
                      key={et.id}
                      type="button"
                      title={et.name}
                      onClick={() => setEtiquetaId(et.id)}
                      className={cn(
                        "flex w-20 shrink-0 flex-col gap-0.5 rounded-md border-2 p-0.5",
                        etiquetaEscolhida === et.id
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/30",
                      )}
                    >
                      <PriceStyleThumb
                        style={et.style}
                        aspect={proporcaoDaEtiqueta}
                      />
                      <span className="truncate text-[10px]">{et.name}</span>
                    </button>
                  ))}
                </div>

                <Label className="mt-2">Disposição</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["grade", "Grade", "Todos do mesmo tamanho"],
                      [
                        "destaque",
                        "Destaque + grade",
                        "O 1º produto em grande",
                      ],
                    ] as const
                  ).map(([valor, rotulo, detalhe]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setMolde(valor)}
                      className={cn(
                        "flex flex-col rounded-md border-2 px-3 py-2 text-left",
                        molde === valor
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/40 hover:bg-muted",
                      )}
                    >
                      <span className="text-sm font-medium">{rotulo}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {detalhe}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Estilo</Label>
                <label
                  htmlFor="estilo-livre"
                  className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm"
                >
                  <Checkbox
                    id="estilo-livre"
                    checked={estiloLivre}
                    onCheckedChange={(v) => setEstiloLivre(v === true)}
                  />
                  <Sparkles className="size-3.5 text-primary" />
                  Deixar a IA escolher estilo e cor
                </label>
                <div
                  className={cn(
                    "grid grid-cols-1 gap-1.5",
                    estiloLivre && "opacity-50",
                  )}
                >
                  {CLIMAS_OFERTA.map((c) => {
                    const p = paletaDoClima(
                      c.value,
                      clima === c.value ? corBase : c.corPadrao,
                    );
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setClima(c.value);
                          setCorBase(c.corPadrao);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-md border-2 px-3 py-1.5 text-left text-sm",
                          clima === c.value
                            ? "border-primary"
                            : "border-transparent bg-muted/40 hover:bg-muted",
                        )}
                      >
                        <span className="flex overflow-hidden rounded">
                          {[p.fundo, p.titulo, p.destaque, p.card].map(
                            // Índice como chave: a paleta repete cor (título e
                            // preço podem ser o mesmo amarelo).
                            (cor, i) => (
                              <span
                                key={i}
                                className="size-5"
                                style={{ background: cor }}
                              />
                            ),
                          )}
                        </span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  Cor base
                  <ColorSwatch value={corBase} onChange={setCorBase} />
                </div>
              </div>
            </div>
          )}

          {passo === 4 && (
            // Prévia à esquerda, níveis à direita: empilhado, a lista passava
            // da altura do diálogo e ficava por baixo do rodapé.
            <div className="grid grid-cols-1 items-start gap-6 py-2 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="flex w-36 flex-col items-center gap-2 rounded-lg p-3 shadow"
                  style={{
                    background: `linear-gradient(180deg, ${paleta.fundo}, ${paleta.fundoAte})`,
                    aspectRatio:
                      formatoEfetivo === "story"
                        ? "9 / 16"
                        : formatoEfetivo === "feed"
                          ? "4 / 5"
                          : "1 / 1.414",
                  }}
                >
                  <span
                    className="text-center text-sm font-black uppercase leading-tight"
                    style={{ color: paleta.titulo, fontFamily: paleta.fonte }}
                  >
                    {nome || "Oferta"}
                  </span>
                  <div className="grid w-full flex-1 grid-cols-2 gap-1.5">
                    {Array.from({ length: Math.min(4, ids.length || 4) }).map(
                      (_, i) => (
                        <span
                          key={i}
                          className="flex flex-col justify-end rounded-sm p-1"
                          style={{ background: paleta.card }}
                        >
                          <span
                            className="h-2 rounded-sm"
                            style={{ background: paleta.destaque }}
                          />
                        </span>
                      ),
                    )}
                  </div>
                </div>
                <ul className="text-center text-xs text-muted-foreground">
                  <li>
                    {
                      FORMATOS_OFERTA.find((f) => f.value === formatoEfetivo)
                        ?.label
                    }{" "}
                    · {ids.length} produto(s) em {paginas} página(s)
                  </li>
                  <li>
                    {CLIMAS_OFERTA.find((c) => c.value === clima)?.label} ·{" "}
                    {molde === "destaque" ? "destaque + grade" : "grade"}
                  </li>
                  {validade && <li>Válida até {validade.replace("T", " ")}</li>}
                </ul>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <Label>Quem monta</Label>
                  {estimativa.data && (
                    <span className="text-xs text-muted-foreground">
                      Saldo: {estimativa.data.saldo} ★
                    </span>
                  )}
                </div>
                {(
                  [
                    {
                      value: "SEM" as const,
                      label: "Sem IA",
                      detalhe: "Monta com o estilo escolhido",
                      preco: "grátis",
                    },
                    ...NIVEIS_OFERTA.map((n) => ({
                      value: n.value,
                      label: `IA ${n.label}`,
                      detalhe: `${n.detalhe} · escolhe disposição, chamada e ordem`,
                      preco: estimativa.data
                        ? `~${
                            Math.round(
                              (estimativa.data.estimativas[n.value] +
                                (arteIa ? estimativa.data.arte[n.value] : 0)) *
                                100,
                            ) / 100
                          } ★`
                        : "…",
                    })),
                  ] as const
                ).map((op) => {
                  const semIa = op.value !== "SEM" && !iaNoAr;
                  return (
                    <button
                      key={op.value}
                      type="button"
                      disabled={semIa || trabalhando}
                      onClick={() => setNivel(op.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-md border-2 px-3 py-1.5 text-left text-sm",
                        nivelEfetivo === op.value
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/40 hover:bg-muted",
                        semIa && "opacity-40",
                      )}
                    >
                      <span className="flex flex-1 flex-col">
                        <span className="font-medium">{op.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {op.detalhe}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums">{op.preco}</span>
                    </button>
                  );
                })}
                {estimativa.data && !iaNoAr && (
                  <p className="text-[11px] text-muted-foreground">
                    A IA ainda não está configurada nesta instalação.
                  </p>
                )}
                {nivelEfetivo !== "SEM" &&
                  nivelEfetivo !== estimativa.data?.nivelPadrao && (
                    <label
                      htmlFor="nivel-padrao"
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Checkbox
                        id="nivel-padrao"
                        checked={salvarPadrao}
                        onCheckedChange={(v) => setSalvarPadrao(v === true)}
                      />
                      Usar este nível como padrão da organização
                    </label>
                  )}
                {nivelEfetivo !== "SEM" && iaNoAr && (
                  <label
                    htmlFor="arte-ia"
                    className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs"
                  >
                    <Checkbox
                      id="arte-ia"
                      checked={arteIa}
                      onCheckedChange={(v) => setArteIa(v === true)}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">
                        Arte premium desenhada pela IA
                      </span>
                      <span className="text-muted-foreground">
                        Título em 3D, papel rasgado e fundo de designer. Foto,
                        nome e preço entram por cima, exatos e editáveis. Leva
                        até ~1 min.
                      </span>
                    </span>
                  </label>
                )}
                {estiloLivre && nivelEfetivo === "SEM" && (
                  <p className="text-[11px] text-amber-600">
                    Sem IA, vale o estilo marcado no passo anterior.
                  </p>
                )}
                {trabalhando && (
                  <p className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="size-3.5 animate-spin" />A IA está
                    montando a oferta…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {passo > 0 && (
            <Button variant="outline" onClick={() => setPasso((p) => p - 1)}>
              Voltar
            </Button>
          )}
          {passo < PASSOS.length - 1 ? (
            <Button
              disabled={!podeAvancar}
              onClick={() => setPasso((p) => p + 1)}
            >
              Continuar
            </Button>
          ) : (
            <Button
              disabled={gerando || trabalhando || ids.length === 0}
              onClick={gerar}
            >
              {gerando || trabalhando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Gerar oferta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Miniatura({ chave }: { chave: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {chave ? (
        // biome-ignore lint/performance/noImgElement: miniatura do R2
        <img
          src={chave.startsWith("http") ? chave : constructUrl(chave)}
          alt=""
          className="size-full object-contain"
        />
      ) : (
        <ImageOff className="size-3.5 text-muted-foreground" />
      )}
    </span>
  );
}

function LogoPorIa({
  disponivel,
  precos,
  nivel,
  onNivel,
  pedido,
  onPedido,
  chave,
  gerando,
  semNome,
  onGerar,
}: {
  disponivel: boolean;
  precos?: Record<NivelOferta, number>;
  nivel: NivelOferta;
  onNivel: (n: NivelOferta) => void;
  pedido: string;
  onPedido: (v: string) => void;
  chave: string | null;
  gerando: boolean;
  semNome: boolean;
  onGerar: (n: NivelOferta) => void;
}) {
  if (!disponivel) {
    return (
      <p className="text-[11px] text-muted-foreground">
        A geração de imagem ainda não está configurada nesta instalação.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Select value={nivel} onValueChange={(v) => onNivel(v as NivelOferta)}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NIVEIS_OFERTA.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                {n.label}
                {precos ? ` · ~${precos[n.value]} ★` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={gerando || semNome}
          onClick={() => onGerar(nivel)}
          title={semNome ? "Dê um nome à oferta no passo anterior" : undefined}
        >
          {gerando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {chave ? "Gerar outro" : "Gerar logo"}
        </Button>
      </div>
      <Input
        value={pedido}
        onChange={(e) => onPedido(e.target.value)}
        placeholder="Algum pedido? Ex.: com uma tesoura rasgando a etiqueta"
        className="h-8 text-xs"
      />
      {gerando && (
        <p className="text-[11px] text-muted-foreground">
          Criando o logo — leva alguns segundos…
        </p>
      )}
      {chave && !gerando && (
        <div className="flex h-20 items-center justify-center rounded bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
          {/* biome-ignore lint/performance/noImgElement: logo recém-gerado no R2 */}
          <img
            src={constructUrl(chave)}
            alt="Logo gerado"
            className="h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
