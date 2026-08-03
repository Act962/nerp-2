"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { AlignCenter, AlignLeft, AlignRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Famílias genéricas de propósito.
 *
 * O canvas desenha com fontes do SISTEMA, não com a fonte da página. Oferecer
 * "Geist" renderizaria um fallback silencioso e a imagem sairia diferente do que
 * a pessoa viu — genéricas existem em toda máquina e o que se vê é o que sai.
 */
const FONTS = [
  { value: "sans-serif", label: "Sem serifa" },
  { value: "serif", label: "Com serifa" },
  { value: "monospace", label: "Monoespaçada" },
  { value: '"Arial Black", sans-serif', label: "Arial Black" },
  { value: "Impact, sans-serif", label: "Impact" },
] as const;

const SIZES = [
  { value: "1000x1000", label: "Quadrado 1:1" },
  { value: "1200x630", label: "Paisagem 16:9" },
  { value: "1200x400", label: "Faixa 3:1" },
  { value: "800x1200", label: "Retrato 2:3" },
] as const;

const WEIGHTS = [
  { value: "400", label: "Normal" },
  { value: "600", label: "Semi-negrito" },
  { value: "700", label: "Negrito" },
  { value: "900", label: "Extra negrito" },
] as const;

interface Config {
  text: string;
  background: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  align: "left" | "center" | "right";
  size: string;
}

const DEFAULTS: Config = {
  text: "PINHO BRIL",
  background: "#ffffff",
  color: "#000000",
  fontFamily: "sans-serif",
  fontSize: 96,
  fontWeight: "700",
  align: "center",
  size: "1000x1000",
};

/** Margem lateral, em fração da largura. Texto colado na borda corta na impressão. */
const PADDING_RATIO = 0.08;

/**
 * Desenha o texto na imagem, quebrando linhas e encolhendo para caber.
 *
 * Sem o encolhimento, um nome longo sai cortado nas bordas — e a pessoa só
 * descobre quando a imagem já está carimbada na foto do promotor.
 */
function draw(canvas: HTMLCanvasElement, config: Config) {
  const [width, height] = config.size.split("x").map(Number);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = config.background;
  ctx.fillRect(0, 0, width, height);

  const padding = width * PADDING_RATIO;
  const maxWidth = width - padding * 2;
  const lines = config.text.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) return;

  // Encolhe até a linha mais larga caber e o bloco inteiro caber na altura.
  let fontSize = config.fontSize;
  const fits = () => {
    ctx.font = `${config.fontWeight} ${fontSize}px ${config.fontFamily}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    return (
      widest <= maxWidth && lines.length * fontSize * 1.25 <= height - padding
    );
  };
  while (fontSize > 8 && !fits()) fontSize -= 2;

  ctx.font = `${config.fontWeight} ${fontSize}px ${config.fontFamily}`;
  ctx.fillStyle = config.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = config.align;

  const x =
    config.align === "center"
      ? width / 2
      : config.align === "left"
        ? padding
        : width - padding;

  const lineHeight = fontSize * 1.25;
  const start = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, start + index * lineHeight);
  });
}

/**
 * Gera a imagem da senha do mês a partir de texto.
 *
 * Existe porque a senha do mês quase sempre é só uma palavra num fundo liso — e
 * hoje isso obriga alguém a abrir um editor de imagem fora do sistema, exportar
 * e subir. Aqui a coordenação digita e pronto.
 */
export function SenhaImageEditor({
  onGenerated,
}: {
  onGenerated: (key: string) => void;
}) {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, config);
  }, [config]);

  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || config.text.trim().length === 0) {
      toast.error("Escreva o texto da senha");
      return;
    }

    setSaving(true);
    try {
      // PNG, não JPEG: fundo liso com texto fica com bordas sujas em JPEG, e a
      // imagem é carimbada por cima da foto do promotor.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Não foi possível gerar a imagem");

      const key = await uploadToR2(
        new File([blob], `senha-${Date.now()}.png`, { type: "image/png" }),
        true,
      );
      onGenerated(key);
      toast.success("Imagem da senha gerada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao gerar a imagem",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center rounded-lg border bg-muted/30 p-3">
        {/* O canvas tem a dimensão real; o CSS só o encaixa na caixa. */}
        <canvas
          ref={canvasRef}
          className="max-h-48 w-auto max-w-full rounded border bg-white"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="senha-texto">Texto</Label>
        <textarea
          id="senha-texto"
          value={config.text}
          onChange={(event) => set("text", event.target.value)}
          rows={2}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder={"PINHO BRIL"}
        />
        <p className="text-xs text-muted-foreground">
          Enter quebra a linha. Cada linha é centralizada por conta própria.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="senha-bg">Cor do fundo</Label>
          <div className="flex gap-2">
            <input
              id="senha-bg"
              type="color"
              value={config.background}
              onChange={(event) => set("background", event.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={config.background}
              onChange={(event) => set("background", event.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="senha-cor">Cor do texto</Label>
          <div className="flex gap-2">
            <input
              id="senha-cor"
              type="color"
              value={config.color}
              onChange={(event) => set("color", event.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={config.color}
              onChange={(event) => set("color", event.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Fonte</Label>
          <Select
            value={config.fontFamily}
            onValueChange={(value) => set("fontFamily", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Peso</Label>
          <Select
            value={config.fontWeight}
            onValueChange={(value) => set("fontWeight", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHTS.map((weight) => (
                <SelectItem key={weight.value} value={weight.value}>
                  {weight.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Dimensão</Label>
          <Select
            value={config.size}
            onValueChange={(value) => set("size", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Alinhamento</Label>
          <div className="flex gap-1">
            {(
              [
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight],
              ] as const
            ).map(([value, Icon]) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={config.align === value ? "default" : "outline"}
                aria-label={`Alinhar à ${value}`}
                onClick={() => set("align", value)}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          Tamanho da fonte:{" "}
          <span className="tabular-nums">{config.fontSize}px</span>
        </Label>
        <Slider
          value={[config.fontSize]}
          min={16}
          max={240}
          step={4}
          onValueChange={([value]) => set("fontSize", value)}
        />
        <p className="text-xs text-muted-foreground">
          Se o texto não couber, ele encolhe sozinho para não sair cortado.
        </p>
      </div>

      <Button
        type="button"
        className="w-full gap-1.5"
        disabled={saving}
        onClick={save}
      >
        {saving ? <Spinner /> : <Check className="size-4" />}
        Usar esta imagem
      </Button>
    </div>
  );
}
