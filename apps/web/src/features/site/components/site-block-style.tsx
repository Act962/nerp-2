"use client";

import type { BlockStyle, SiteBlock } from "@nerp/site-content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Switch } from "@/components/ui/switch";

/**
 * A aparência de um bloco: cores, tipografia, botões, efeitos e a flutuação
 * das imagens.
 *
 * Fica num acordeão fechado, e não solto no formulário: são muitos controles e
 * quase sempre não se mexe em nenhum. Aberto por padrão, ele empurraria os
 * campos de CONTEÚDO — que é o que a pessoa veio fazer — para fora da tela.
 *
 * Todo campo pode voltar a "padrão": é o que garante que experimentar não custe
 * nada. Sem o caminho de volta, a primeira cor errada fica para sempre.
 */

const FAMILIES = {
  padrao: "Padrão do site",
  titulo: "Título",
  mono: "Monoespaçada",
} as const;

const WEIGHTS = {
  "300": "Leve",
  "400": "Normal",
  "500": "Média",
  "600": "Semi-negrito",
  "700": "Negrito",
  "800": "Extra-negrito",
} as const;

const SLOTS = [
  { key: "title", label: "Título" },
  { key: "text", label: "Texto" },
  { key: "items", label: "Itens e subtítulos" },
] as const;

const EFFECTS = {
  pulso: "Pulsar",
  brilho: "Brilhar",
  flutuar: "Subir e descer",
} as const;

type Efeito = NonNullable<BlockStyle["effect"]>;
type Imagem = NonNullable<BlockStyle["image"]>;

/**
 * Os sub-objetos de efeito e imagem têm `default` no schema, então o tipo lido
 * do banco traz os campos como obrigatórios. Estes dois montam o objeto
 * COMPLETO a cada mexida — um spread parcial não satisfaz o tipo, e preencher
 * na mão em cada `onChange` repetiria os mesmos padrões cinco vezes.
 */
function comEfeito(atual: Efeito | undefined, patch: Partial<Efeito>): Efeito {
  return {
    enabled: atual?.enabled ?? false,
    kind: atual?.kind ?? "pulso",
    intensity: atual?.intensity ?? 50,
    ...patch,
  };
}

function comImagem(atual: Imagem | undefined, patch: Partial<Imagem>): Imagem {
  return {
    float: atual?.float ?? false,
    smoothness: atual?.smoothness ?? 60,
    shadow: atual?.shadow ?? true,
    shadowStrength: atual?.shadowStrength ?? 45,
    ...patch,
  };
}

export function SiteBlockStyle({
  block,
  onChange,
}: {
  block: SiteBlock;
  onChange: (block: SiteBlock) => void;
}) {
  const style: BlockStyle = block.style ?? {};

  const set = (patch: Partial<BlockStyle>) =>
    onChange({ ...block, style: { ...style, ...patch } });

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="aparencia">
        <AccordionTrigger className="text-sm">Aparência</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-5 pt-2">
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fundo
            </p>
            <Cor
              label="Cor"
              value={style.background}
              onChange={(background) => set({ background })}
            />
            <Cor
              label="Segunda cor (degradê)"
              value={style.backgroundTo}
              onChange={(backgroundTo) => set({ backgroundTo })}
              hint="Preenchida, o fundo vira um degradê entre as duas."
            />
          </section>

          {SLOTS.map(({ key, label }) => {
            const slot = style[key] ?? {};
            const setSlot = (patch: Record<string, unknown>) =>
              set({ [key]: { ...slot, ...patch } } as Partial<BlockStyle>);
            return (
              <section key={key} className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <Cor
                  label="Cor da fonte"
                  value={slot.color}
                  onChange={(color) => setSlot({ color })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Numero
                    label="Tamanho (rem)"
                    value={slot.size}
                    step={0.1}
                    min={0.6}
                    max={6}
                    onChange={(size) => setSlot({ size })}
                  />
                  <Lista
                    label="Peso"
                    value={slot.weight}
                    options={WEIGHTS}
                    onChange={(weight) => setSlot({ weight })}
                  />
                </div>
                <Lista
                  label="Tipografia"
                  value={slot.family}
                  options={FAMILIES}
                  onChange={(family) => setSlot({ family })}
                />
              </section>
            );
          })}

          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Botões
            </p>
            <Cor
              label="Fundo do botão"
              value={style.button?.background}
              onChange={(background) =>
                set({ button: { ...style.button, background } })
              }
            />
            <Cor
              label="Segunda cor (degradê)"
              value={style.button?.backgroundTo}
              onChange={(backgroundTo) =>
                set({ button: { ...style.button, backgroundTo } })
              }
            />
            <Cor
              label="Cor da fonte do botão"
              value={style.button?.color}
              onChange={(color) => set({ button: { ...style.button, color } })}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`fx-${block.id}`}>Efeito de destaque</Label>
              <Switch
                id={`fx-${block.id}`}
                checked={style.effect?.enabled ?? false}
                onCheckedChange={(enabled) =>
                  set({ effect: comEfeito(style.effect, { enabled }) })
                }
              />
            </div>
            {style.effect?.enabled && (
              <>
                <Lista
                  label="Tipo"
                  value={style.effect.kind}
                  options={EFFECTS}
                  onChange={(kind) =>
                    set({
                      effect: comEfeito(style.effect, {
                        enabled: true,
                        kind: (kind ?? "pulso") as Efeito["kind"],
                      }),
                    })
                  }
                />
                <Faixa
                  label="Intensidade"
                  value={style.effect.intensity}
                  onChange={(intensity) =>
                    set({
                      effect: comEfeito(style.effect, {
                        enabled: true,
                        intensity,
                      }),
                    })
                  }
                />
              </>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`float-${block.id}`}>Imagem flutuante</Label>
              <Switch
                id={`float-${block.id}`}
                checked={style.image?.float ?? false}
                onCheckedChange={(float) =>
                  set({ image: comImagem(style.image, { float }) })
                }
              />
            </div>
            {style.image?.float && (
              <>
                <Faixa
                  label="Suavidade"
                  value={style.image.smoothness}
                  hint="Mais alto, movimento mais lento e macio."
                  onChange={(smoothness) =>
                    set({
                      image: comImagem(style.image, {
                        float: true,
                        smoothness,
                      }),
                    })
                  }
                />
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`shadow-${block.id}`}>Sombra na base</Label>
                  <Switch
                    id={`shadow-${block.id}`}
                    checked={style.image.shadow}
                    onCheckedChange={(shadow) =>
                      set({
                        image: comImagem(style.image, { float: true, shadow }),
                      })
                    }
                  />
                </div>
                {style.image.shadow && (
                  <Faixa
                    label="Força da sombra"
                    value={style.image.shadowStrength}
                    onChange={(shadowStrength) =>
                      set({
                        image: comImagem(style.image, {
                          float: true,
                          shadowStrength,
                        }),
                      })
                    }
                  />
                )}
              </>
            )}
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/**
 * Conta-gotas + campo de texto lado a lado.
 *
 * O `input[type=color]` abre o seletor do sistema, que no macOS traz o
 * conta-gotas de tela. O campo de texto ao lado existe porque quem já tem o
 * código da marca não quer caçá-lo na roda de cores.
 */
function Cor({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value || "#0b1220"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          value={value ?? ""}
          placeholder="padrão"
          onChange={(e) => onChange(e.target.value || undefined)}
          className="font-mono"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
          >
            Limpar
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Numero({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="padrão"
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </div>
  );
}

function Lista({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Record<string, string>;
  onChange: (value: string | undefined) => void;
}) {
  // "padrão" é uma opção de verdade na lista, e não só o estado vazio: sem ela
  // não há como desfazer uma escolha depois de feita.
  const PADRAO = "__padrao__";
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      <Select
        value={value ?? PADRAO}
        onValueChange={(next) => onChange(next === PADRAO ? undefined : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PADRAO}>Padrão</SelectItem>
          {Object.entries(options).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Faixa({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-normal">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={5}
        onValueChange={([next]) => onChange(next)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
