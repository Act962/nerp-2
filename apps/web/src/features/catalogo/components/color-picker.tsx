"use client";

import { PipetteIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { SketchPicker } from "react-color";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A cor está escrita por inteiro? Só então ela vale para quem lê. */
export function isHexValido(valor: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim());
}

/**
 * O conta-gotas do navegador.
 *
 * É o que atende "a cor EXATA da marca": a pessoa abre a logo numa aba, clica
 * e pega o pixel. Só existe em Chrome e Edge — por isso o botão só aparece
 * quando a API existe, em vez de aparecer e não fazer nada.
 */
type JanelaComConta = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

function contaGotasDisponivel(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

/**
 * O campo hexadecimal precisa de rascunho local: só propaga quando o valor
 * está completo, mas sem guardar o que foi digitado seria impossível chegar
 * lá — um "#20409" intermediário nunca apareceria na tela.
 */
function HexInput({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: string;
  onChange: (hex: string) => void;
}) {
  const [rascunho, setRascunho] = useState(valor);
  const [ultimoAplicado, setUltimoAplicado] = useState(valor);

  // Cor trocada por fora (amostra, roda, conta-gotas): o rascunho acompanha.
  if (valor !== ultimoAplicado) {
    setUltimoAplicado(valor);
    setRascunho(valor);
  }

  return (
    <input
      value={rascunho}
      spellCheck={false}
      maxLength={7}
      aria-label={`${rotulo} em hexadecimal`}
      className="h-8 w-24 rounded-md border bg-transparent px-2 font-mono text-xs uppercase"
      onChange={(evento) => {
        const proximo = evento.target.value.trim();
        setRascunho(proximo);
        if (isHexValido(proximo)) {
          setUltimoAplicado(proximo);
          onChange(proximo);
        }
      }}
      onBlur={() => setRascunho(valor)}
    />
  );
}

interface ColorPickerProps {
  label: string;
  description?: string;
  /** `null` = herdando o padrão; o botão "Padrão" some. */
  value: string | null;
  /** A cor mostrada quando `value` é nulo. */
  defaultValue: string;
  /** Amostras rápidas. */
  presets?: readonly string[];
  /** `null` chega quando a pessoa volta ao padrão — só se `onReset` existir. */
  onChange: (hex: string) => void;
  onReset?: () => void;
}

/**
 * O seletor de cor do catálogo.
 *
 * Três caminhos para a mesma cor, porque são três pessoas diferentes: a
 * amostra para quem só quer uma cor bonita, a roda para quem está procurando,
 * e o hexadecimal (mais o conta-gotas) para quem já tem a cor da marca e
 * precisa dela exata — que era justamente o que a paleta fechada não dava.
 */
export function ColorPicker({
  label,
  description,
  value,
  defaultValue,
  presets = [],
  onChange,
  onReset,
}: ColorPickerProps) {
  const [aberto, setAberto] = useState(false);
  const corAtual = value && isHexValido(value) ? value : defaultValue;

  const pegarDaTela = async () => {
    const janela = window as JanelaComConta;
    if (!janela.EyeDropper) return;
    try {
      const { sRGBHex } = await new janela.EyeDropper().open();
      if (isHexValido(sRGBHex)) onChange(sRGBHex.toLowerCase());
    } catch {
      // Cancelar com Esc rejeita a promessa. Cancelar não é erro.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {onReset && value !== null && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <RotateCcwIcon className="size-3" />
            Padrão
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md border pr-2 pl-1 shadow-xs transition-colors hover:bg-accent"
              aria-label={`Escolher ${label.toLowerCase()}`}
            >
              <span
                className="size-6 rounded-sm border"
                style={{ backgroundColor: corAtual }}
              />
              <span className="font-mono text-xs uppercase">{corAtual}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto border-0 p-0 shadow-xl"
            align="start"
          >
            <SketchPicker
              color={corAtual}
              disableAlpha
              presetColors={[...presets]}
              onChange={(cor) => onChange(cor.hex)}
            />
          </PopoverContent>
        </Popover>

        <HexInput rotulo={label} valor={corAtual} onChange={onChange} />

        {contaGotasDisponivel() && (
          <button
            type="button"
            onClick={pegarDaTela}
            title="Capturar uma cor da tela"
            aria-label="Capturar uma cor da tela"
            className="flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent"
          >
            <PipetteIcon className="size-4" />
          </button>
        )}
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              title={preset}
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
              className={cn(
                "size-5 cursor-pointer rounded-full border transition-transform hover:scale-110",
                corAtual.toLowerCase() === preset.toLowerCase()
                  ? "ring-2 ring-accent-foreground/70 ring-offset-2 ring-offset-background"
                  : "border-border",
              )}
            />
          ))}
        </div>
      )}

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
