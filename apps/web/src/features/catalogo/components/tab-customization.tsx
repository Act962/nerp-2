"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  PipetteIcon,
  PlusIcon,
  Search,
  Trash2Icon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { SketchPicker } from "react-color";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  type Combinacao,
  FUNDO_PADRAO_CATALOGO,
  TEMA_PADRAO_CATALOGO,
  contraste,
  coresDominantes,
  destacarSobre,
  gerarCombinacoes,
  isHexValido,
  tintaSobre,
} from "@/features/storefront/lib/cores";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import type { CatalogSettingsProps } from "./catalog";
import { ColorPicker } from "./color-picker";
import { CarouselUploader } from "./file-uploader/carousel-uploader";
import { colors } from "./mock/catalog-moc";

interface CustomizationTabProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

const MAX_CORES_DA_MARCA = 8;

/** Cabeçalho de quem nunca escolheu: o branco que a vitrine usa por padrão. */
const CABECALHO_PADRAO = "#ffffff";

/** Fundos que funcionam com quase qualquer tema — claros, e um escuro. */
const FUNDOS_SUGERIDOS = [
  "#ffffff",
  "#f5f5f5",
  "#f1f5f9",
  "#faf5ff",
  "#fff7ed",
  "#f0fdf4",
  "#1f2937",
  "#111111",
];

function mesmaCor(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function semRepetir(lista: readonly string[]): string[] {
  return lista.filter(
    (cor, i) => lista.findIndex((outra) => mesmaCor(outra, cor)) === i,
  );
}

export function TabCustomization({
  settings,
  setSettings,
}: CustomizationTabProps) {
  const [imageSelected, setImageSelected] = useState<string | undefined>(
    undefined,
  );

  const onChangeImage = (imageNow: string) => {
    setImageSelected(imageNow);
    setSettings({
      ...settings,
      bannerImages: [...settings.bannerImages, imageNow],
    });
  };

  useEffect(() => {
    setImageSelected(undefined);
  }, [settings.bannerImages]);

  const tema = isHexValido(settings.theme)
    ? settings.theme
    : TEMA_PADRAO_CATALOGO;
  const cabecalho = isHexValido(settings.headerColor)
    ? settings.headerColor
    : CABECALHO_PADRAO;
  const fundo = isHexValido(settings.backgroundColor)
    ? settings.backgroundColor
    : FUNDO_PADRAO_CATALOGO;

  const marca = settings.brandColors;
  // A paleta da marca vem primeiro em todo seletor: é o atalho que importa.
  const comMarca = (sugeridas: readonly string[]) =>
    semRepetir([...marca, ...sugeridas]);

  const aplicar = (combinacao: Combinacao) =>
    setSettings({
      ...settings,
      theme: combinacao.tema,
      headerColor: combinacao.cabecalho,
      backgroundColor: combinacao.fundo,
    });

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div>
        <h2 className="font-semibold text-foreground text-xl">
          Personalização
        </h2>
        <p className="text-muted-foreground text-sm">
          Customize a aparência do seu catálogo
        </p>
      </div>

      <Card className="gap-4 p-6">
        <Label htmlFor="carouselImage">Carrossel inicial</Label>
        <Field className="text-center">
          <CarouselUploader
            fileTypeAccepted="image"
            onConfirm={onChangeImage}
            value={imageSelected}
          />
          <FieldDescription>
            Formatos aceitos: JPG, PNG, GIF
            <br />
            Tamanho máximo: 5MB
          </FieldDescription>
        </Field>
        <p className="text-muted-foreground text-xs">
          Aparecerá no topo do catálogo
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {settings.bannerImages.map((image, index) => (
            <MiniaturaDoBanner
              key={image}
              chave={image}
              indice={index}
              onRemover={() =>
                setSettings({
                  ...settings,
                  bannerImages: settings.bannerImages.filter(
                    (img) => img !== image,
                  ),
                })
              }
            />
          ))}
        </div>
      </Card>

      <CoresDaMarca
        cores={marca}
        logo={settings.logo}
        onChange={(brandColors) => setSettings({ ...settings, brandColors })}
      />

      <Equilibrio
        marca={marca}
        tema={tema}
        cabecalho={cabecalho}
        fundo={fundo}
        onAplicar={aplicar}
      />

      <Card className="gap-6 p-6">
        <div className="flex flex-col gap-1">
          <Label>Ajuste fino</Label>
          <p className="text-muted-foreground text-xs">
            Cada cor separada. As cores da marca aparecem primeiro nas amostras.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ColorPicker
            label="Cor do tema"
            description="Botões, selos de desconto e destaques."
            value={settings.theme || null}
            defaultValue={TEMA_PADRAO_CATALOGO}
            presets={comMarca(colors)}
            onChange={(hex) => setSettings({ ...settings, theme: hex })}
            onReset={() => setSettings({ ...settings, theme: "" })}
          />
          <ColorPicker
            label="Cor do cabeçalho"
            description="O topo da loja. O texto se ajusta sozinho."
            value={settings.headerColor || null}
            defaultValue={CABECALHO_PADRAO}
            presets={comMarca(["#ffffff", "#111111", ...FUNDOS_SUGERIDOS])}
            onChange={(hex) => setSettings({ ...settings, headerColor: hex })}
            onReset={() => setSettings({ ...settings, headerColor: "" })}
          />
          <ColorPicker
            label="Cor de fundo da página"
            description="O fundo de todas as páginas do catálogo."
            value={settings.backgroundColor || null}
            defaultValue={FUNDO_PADRAO_CATALOGO}
            presets={comMarca(FUNDOS_SUGERIDOS)}
            onChange={(hex) =>
              setSettings({ ...settings, backgroundColor: hex })
            }
            onReset={() => setSettings({ ...settings, backgroundColor: "" })}
          />
        </div>

        <AvisosDeContraste
          tema={tema}
          cabecalho={cabecalho}
          fundo={fundo}
          onCorrigirTema={() =>
            setSettings({ ...settings, theme: destacarSobre(tema, fundo) })
          }
        />

        <Previa
          nome={settings.metaTitle || "Minha loja"}
          tema={tema}
          cabecalho={cabecalho}
          fundo={fundo}
        />
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="astroEnabled">Astro atendendo na vitrine</Label>
            <p className="text-muted-foreground text-xs">
              Um assistente que conhece a sua loja responde dúvidas de quem está
              navegando: produtos, preços, formas de pagamento e entrega. Cada
              conversa consome ★ da organização.
            </p>
          </div>
          <Switch
            id="astroEnabled"
            checked={settings.astroEnabled}
            onCheckedChange={(marcado) =>
              setSettings({ ...settings, astroEnabled: marcado })
            }
          />
        </div>
      </Card>
    </div>
  );
}

function MiniaturaDoBanner({
  chave,
  indice,
  onRemover,
}: {
  chave: string;
  indice: number;
  onRemover: () => void;
}) {
  const url = useConstructUrl(chave);
  return (
    <div className="group relative size-13 overflow-hidden rounded-sm border">
      <Image src={url} alt={`Imagem do catálogo ${indice + 1}`} fill />
      <button
        type="button"
        aria-label="Remover imagem"
        onClick={onRemover}
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2Icon className="size-4 text-white" />
      </button>
    </div>
  );
}

/**
 * A paleta da marca: as cores que a loja usa em tudo (logo, fachada, sacola).
 *
 * "Puxar da logo" lê os pixels num canvas. Imagem de outro domínio só pode ser
 * lida se o servidor dela mandar CORS; quando não manda, o navegador proíbe e
 * a pessoa recebe o aviso — o conta-gotas continua sendo o caminho manual.
 */
function CoresDaMarca({
  cores,
  logo,
  onChange,
}: {
  cores: string[];
  logo: string;
  onChange: (cores: string[]) => void;
}) {
  const [nova, setNova] = useState("#2563eb");
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const urlDaLogo = useConstructUrl(logo);
  const cheia = cores.length >= MAX_CORES_DA_MARCA;

  const adicionar = (lista: string[]) =>
    onChange(semRepetir([...cores, ...lista]).slice(0, MAX_CORES_DA_MARCA));

  const puxarDaLogo = () => {
    if (!urlDaLogo) return;
    setLendo(true);
    const imagem = new window.Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const lado = 64;
        canvas.width = lado;
        canvas.height = lado;
        const contexto = canvas.getContext("2d");
        if (!contexto) throw new Error();
        contexto.drawImage(imagem, 0, 0, lado, lado);
        const encontradas = coresDominantes(
          contexto.getImageData(0, 0, lado, lado).data,
        );
        if (encontradas.length === 0) {
          toast.info("A logo não tem cores marcantes para sugerir.");
        } else {
          adicionar(encontradas);
          toast.success("Cores da logo adicionadas à paleta");
        }
      } catch {
        toast.error(
          "Não deu para ler a logo. Use o conta-gotas no seletor de cor.",
        );
      } finally {
        setLendo(false);
      }
    };
    imagem.onerror = () => {
      setLendo(false);
      toast.error("Não deu para carregar a logo.");
    };
    imagem.src = urlDaLogo;
  };

  return (
    <Card className="gap-4 p-6">
      <div className="flex flex-col gap-1">
        <Label>Cores da marca</Label>
        <p className="text-muted-foreground text-xs">
          Até {MAX_CORES_DA_MARCA} cores. Viram atalho em todos os seletores e a
          base do equilíbrio automático.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cores.map((cor) => (
          <div
            key={cor}
            className="group relative flex items-center gap-2 rounded-full border py-1 pr-2.5 pl-1"
          >
            <span
              className="size-6 rounded-full border border-black/10"
              style={{ backgroundColor: cor }}
            />
            <span className="font-mono text-xs uppercase">{cor}</span>
            <button
              type="button"
              aria-label={`Tirar ${cor} da paleta`}
              onClick={() => onChange(cores.filter((c) => !mesmaCor(c, cor)))}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}

        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" disabled={cheia}>
              <PlusIcon className="size-4" />
              Adicionar cor
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto flex-col gap-2 p-2">
            <SketchPicker
              color={nova}
              disableAlpha
              presetColors={[]}
              onChange={(cor) => setNova(cor.hex)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                adicionar([nova]);
                setAberto(false);
              }}
            >
              Adicionar {nova.toUpperCase()}
            </Button>
          </PopoverContent>
        </Popover>

        {logo && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={cheia || lendo}
            onClick={puxarDaLogo}
          >
            <PipetteIcon className="size-4" />
            {lendo ? "Lendo a logo…" : "Puxar da logo"}
          </Button>
        )}
      </div>

      {cores.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nenhuma cor ainda. Adicione a cor principal da sua marca
          {logo ? " ou puxe as cores da logo" : ""}.
        </p>
      )}
    </Card>
  );
}

/**
 * O equilíbrio automático: a pessoa escolhe a cor base e um clima; o sistema
 * monta tema, cabeçalho e fundo que conversam entre si e têm contraste.
 */
function Equilibrio({
  marca,
  tema,
  cabecalho,
  fundo,
  onAplicar,
}: {
  marca: string[];
  tema: string;
  cabecalho: string;
  fundo: string;
  onAplicar: (combinacao: Combinacao) => void;
}) {
  const bases = semRepetir(marca.length > 0 ? marca : [tema]);
  const [base, setBase] = useState(bases[0]);
  const baseAtual = bases.some((cor) => mesmaCor(cor, base)) ? base : bases[0];
  const combinacoes = gerarCombinacoes(baseAtual);

  return (
    <Card className="gap-4 p-6">
      <div className="flex flex-col gap-1">
        <Label className="flex items-center gap-1.5">
          <WandSparklesIcon className="size-4" />
          Equilíbrio automático
        </Label>
        <p className="text-muted-foreground text-xs">
          Escolha a cor base e um estilo. O sistema combina tema, cabeçalho e
          fundo com contraste garantido — depois é só salvar, ou ajustar.
        </p>
      </div>

      {bases.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Cor base:</span>
          {bases.map((cor) => (
            <button
              key={cor}
              type="button"
              aria-label={`Usar ${cor} como base`}
              aria-pressed={mesmaCor(cor, baseAtual)}
              onClick={() => setBase(cor)}
              className={cn(
                "size-7 rounded-full border border-black/10 transition-transform hover:scale-110",
                mesmaCor(cor, baseAtual) &&
                  "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: cor }}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {combinacoes.map((combinacao) => {
          const emUso =
            mesmaCor(combinacao.tema, tema) &&
            mesmaCor(combinacao.cabecalho, cabecalho) &&
            mesmaCor(combinacao.fundo, fundo);
          return (
            <button
              key={combinacao.id}
              type="button"
              onClick={() => onAplicar(combinacao)}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md",
                emUso && "ring-2 ring-primary",
              )}
            >
              <MiniVitrine
                tema={combinacao.tema}
                cabecalho={combinacao.cabecalho}
                fundo={combinacao.fundo}
              />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="flex items-center gap-1.5 font-medium text-sm">
                  {combinacao.nome}
                  {emUso && <CheckIcon className="size-3.5 text-primary" />}
                </span>
                <span className="text-muted-foreground text-xs">
                  {combinacao.descricao}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** A vitrine em miniatura: cabeçalho, fundo, um cartão e o botão do tema. */
function MiniVitrine({
  tema,
  cabecalho,
  fundo,
}: {
  tema: string;
  cabecalho: string;
  fundo: string;
}) {
  return (
    <div className="flex h-24 flex-col" style={{ backgroundColor: fundo }}>
      <div
        className="flex h-6 items-center gap-1.5 px-2"
        style={{ backgroundColor: cabecalho }}
      >
        <span
          className="h-1.5 w-8 rounded-full opacity-80"
          style={{ backgroundColor: tintaSobre(cabecalho) }}
        />
        <span className="ml-auto h-2.5 w-12 rounded-full bg-white/90" />
      </div>
      <div className="flex flex-1 items-center gap-2 px-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-12 flex-1 flex-col justify-end rounded bg-white p-1 shadow-xs"
          >
            <span
              className="ml-auto size-3 rounded-full"
              style={{ backgroundColor: tema }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AvisosDeContraste({
  tema,
  cabecalho,
  fundo,
  onCorrigirTema,
}: {
  tema: string;
  cabecalho: string;
  fundo: string;
  onCorrigirTema: () => void;
}) {
  const avisos: { texto: string; corrigir?: () => void }[] = [];
  if (contraste(tema, fundo) < 3) {
    avisos.push({
      texto:
        "A cor do tema quase some no fundo: botões e selos ficam difíceis de ver.",
      corrigir: onCorrigirTema,
    });
  }
  if (contraste(cabecalho, fundo) < 1.15 && !mesmaCor(cabecalho, fundo)) {
    avisos.push({
      texto:
        "Cabeçalho e fundo muito parecidos: o topo da loja não se separa do conteúdo.",
    });
  }
  if (avisos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {avisos.map((aviso) => (
        <div
          key={aviso.texto}
          className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1">{aviso.texto}</span>
          {aviso.corrigir && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={aviso.corrigir}
            >
              Ajustar o tema
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A prévia.
 *
 * As cores só se julgam JUNTAS: escolhidas em campos separados, dá para
 * acertar cada uma e ainda assim publicar um preto sobre azul-marinho.
 */
function Previa({
  nome,
  tema,
  cabecalho,
  fundo,
}: {
  nome: string;
  tema: string;
  cabecalho: string;
  fundo: string;
}) {
  const tintaDoFundo = tintaSobre(fundo);
  const tintaDoCabecalho = tintaSobre(cabecalho);
  const botao =
    contraste(tema, cabecalho) < 1.6
      ? { backgroundColor: tintaDoCabecalho, color: cabecalho }
      : { backgroundColor: tema, color: tintaSobre(tema) };

  return (
    <div className="flex flex-col gap-2">
      <Label>Prévia</Label>
      <div className="overflow-hidden rounded-lg border">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: cabecalho, color: tintaDoCabecalho }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-full font-semibold text-xs"
            style={{ backgroundColor: tema, color: tintaSobre(tema) }}
          >
            {nome.slice(0, 2)}
          </span>
          <span className="truncate font-bold">{nome}</span>
          <span className="ml-auto hidden h-8 w-56 items-center gap-2 rounded-full bg-white px-3 text-neutral-500 text-xs sm:flex">
            <Search className="size-3.5" />O que você procura?
          </span>
          <span
            className="rounded-md px-3 py-1.5 font-medium text-xs"
            style={botao}
          >
            Categorias
          </span>
        </div>
        <div
          className="flex gap-3 p-4"
          style={{ backgroundColor: fundo, color: tintaDoFundo }}
        >
          {["Produto de exemplo", "Outro produto"].map((produto, i) => (
            <div
              key={produto}
              className="relative flex w-40 flex-col gap-1 rounded-xl border bg-white p-3 text-neutral-900"
            >
              {i === 0 && (
                <span
                  className="absolute top-2 left-2 rounded-full px-1.5 font-semibold text-[10px]"
                  style={{ backgroundColor: tema, color: tintaSobre(tema) }}
                >
                  -15%
                </span>
              )}
              <div className="h-14 rounded bg-neutral-100" />
              <span className="truncate text-xs">{produto}</span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">R$ 19,90</span>
                <span
                  className="flex size-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: tema, color: tintaSobre(tema) }}
                >
                  <PlusIcon className="size-3.5" />
                </span>
              </div>
            </div>
          ))}
          <p className="hidden self-center text-sm sm:block">
            Texto sobre o fundo
          </p>
        </div>
      </div>
    </div>
  );
}
