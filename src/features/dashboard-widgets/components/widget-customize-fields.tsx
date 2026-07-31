"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BellRing,
  PlayCircle,
  Pipette,
  Target,
  Volume2,
  X,
} from "lucide-react";
import { playAlertSound, primeAlertSound } from "../lib/alert-sound";
import { useNotificationPermission } from "../hooks/use-notification-permission";
import {
  allowedDisplayTypes,
  describeOracleQuery,
  ORACLE_CUSTOM_KEY,
} from "../lib/oracle-query-config";
import {
  isHexColor,
  PASTEL_COLORS,
  type WidgetColor,
} from "../lib/pastel-colors";
import type { ReportTableConfig } from "../lib/report-table";
import {
  hasCustomAppearance,
  TEXT_SIZE_LABEL,
  TEXT_WEIGHT_LABEL,
  type WidgetAlign,
  type WidgetAppearance,
  type WidgetBackground,
  type WidgetBorder,
  type WidgetTextSize,
  type WidgetTextWeight,
} from "../lib/widget-appearance";
import {
  COMPARATOR_OPTIONS,
  DEFAULT_ALERT,
  hasCustomAlert,
  renderAlertMessage,
  type WidgetAlert,
  type WidgetAlertComparator,
} from "../lib/widget-alert";
import { formatWidgetValue } from "../lib/widget-value";
import { WIDGET_ICONS } from "../lib/widget-icons";
import {
  EMPTY_ORACLE_DRAFT,
  type OracleDraft,
  OracleQueryBuilder,
} from "./oracle-query-builder";

export const DISPLAY_TYPE_LABEL: Record<string, string> = {
  STAT: "Número",
  CHART: "Gráfico",
  LIST: "Lista",
  MAP: "Mapa",
  TABLE: "Tabela",
};

export const CHART_KIND_LABEL: Record<string, string> = {
  LINE: "Linha",
  BAR: "Barra",
  DONUT: "Rosca",
};

export type DisplayType = "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
export type ChartKind = "LINE" | "BAR" | "DONUT";

export interface CustomizeEntry {
  key?: string;
  /** Rótulo padrão da fonte — vira o placeholder do campo de nome. */
  label?: string;
  supportedDisplayTypes: readonly DisplayType[];
  supportedChartKinds: readonly ChartKind[];
}

export interface CustomizeState {
  displayType: DisplayType;
  chartKind: ChartKind;
  color: WidgetColor | null;
  icon: string | null;
  // Controlado como string pra permitir campo vazio/parcial durante a
  // digitação — parseado só na hora de salvar.
  targetValue: string;
  /** Vazio = usa o rótulo padrão da fonte. */
  title: string;
  /** Só para a entrada `oracle.custom`. */
  oracle: OracleDraft | null;
  /** Colunas derivadas (% Part., Contrib., % Lucro…) — só quando o modelo
   * aplicado (`Padrões de busca`) declara `report`. */
  report: ReportTableConfig | null;
  /** Alinhamento/cores dos textos do card e do ícone. */
  appearance: WidgetAppearance;
  /** Alerta programado (cron server-side). */
  alert: WidgetAlert;
}

/**
 * Monta o `options` do widget a partir do estado do formulário. Compartilhado
 * pelos dois fluxos (adicionar e editar) para os dois gravarem o mesmo shape.
 */
export function buildOptions(
  state: CustomizeState,
  targetValue: number,
): Record<string, unknown> | null {
  const options: Record<string, unknown> = {};
  if (state.oracle) options.oracle = state.oracle;
  if (state.report) options.report = state.report;
  if (
    state.displayType === "STAT" &&
    Number.isFinite(targetValue) &&
    targetValue > 0
  ) {
    options.targetValue = targetValue;
  }
  // Só grava appearance quando algo saiu do padrão — evita payload gordo com
  // um objeto de defaults em todo widget.
  if (hasCustomAppearance(state.appearance)) {
    options.appearance = state.appearance;
  }
  if (hasCustomAlert(state.alert)) {
    options.alert = state.alert;
  }
  return Object.keys(options).length > 0 ? options : null;
}

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: WidgetColor | null;
  onChange: (key: WidgetColor | null) => void;
}) {
  // Cor livre (conta-gotas): quando `value` é um hex ele fica em destaque; o
  // input nativo é usado só como abridor do picker do SO — todo o feedback
  // visual mora no botão.
  const customHex = value && isHexColor(value) ? value : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        title="Sem cor"
        aria-label="Sem cor"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-transparent text-muted-foreground text-xs",
          value === null
            ? "border-foreground text-foreground"
            : "border-muted-foreground/30 hover:border-muted-foreground/60",
        )}
      >
        <X className="size-3" />
      </button>
      {PASTEL_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          title={color.label}
          aria-label={color.label}
          aria-pressed={value === color.key}
          onClick={() => onChange(color.key)}
          style={{ background: color.hex }}
          className={cn(
            "size-6 shrink-0 rounded-full border-2 transition-transform",
            value === color.key
              ? "scale-110 border-foreground"
              : "border-transparent hover:border-muted-foreground/40",
          )}
        />
      ))}
      {/* Conta-gotas — abre o picker do SO. O <input> nativo fica invisível
        e cobre o rótulo pra receber o clique; o label é o que o usuário vê. */}
      <label
        className={cn(
          "relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-transform",
          customHex
            ? "scale-110 border-foreground"
            : "border-muted-foreground/30 bg-background hover:border-muted-foreground/60",
        )}
        style={customHex ? { background: customHex } : undefined}
        title={
          customHex ? `Cor personalizada ${customHex}` : "Cor personalizada"
        }
        aria-label="Escolher cor personalizada"
      >
        {!customHex && <Pipette className="size-3 text-muted-foreground" />}
        <input
          type="color"
          // Native color picker devolve `#rrggbb`; se algum navegador exótico
          // devolver algo fora do padrão, o schema server-side rejeita e o
          // valor cai para o default.
          value={customHex ?? "#000000"}
          onChange={(event) => {
            const next = event.target.value;
            if (isHexColor(next)) onChange(next);
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function IconSwatchPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        title="Sem ícone"
        aria-label="Sem ícone"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground",
          value === null
            ? "border-foreground bg-background"
            : "border-transparent bg-muted/50 hover:border-muted-foreground/40",
        )}
      >
        <X className="size-3.5" />
      </button>
      {WIDGET_ICONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground",
            value === key
              ? "border-foreground bg-background text-foreground"
              : "border-transparent hover:border-muted-foreground/40",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

// Linha compacta com alinhamento + cor + tamanho + peso de UM texto do card
// (título ou valor). Tudo junto para o usuário ver as escolhas de UM texto
// lado a lado, em vez de correr atrás de 4 campos em seções separadas.
function AppearanceTextRow({
  label,
  align,
  color,
  size,
  weight,
  onAlignChange,
  onColorChange,
  onSizeChange,
  onWeightChange,
}: {
  label: string;
  align: WidgetAlign;
  color: WidgetColor | null;
  size: WidgetTextSize;
  weight: WidgetTextWeight;
  onAlignChange: (next: WidgetAlign) => void;
  onColorChange: (next: WidgetColor | null) => void;
  onSizeChange: (next: WidgetTextSize) => void;
  onWeightChange: (next: WidgetTextWeight) => void;
}) {
  const alignOptions: Array<{
    key: WidgetAlign;
    icon: typeof AlignLeft;
    label: string;
  }> = [
    { key: "left", icon: AlignLeft, label: "Esquerda" },
    { key: "center", icon: AlignCenter, label: "Centro" },
    { key: "right", icon: AlignRight, label: "Direita" },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label={`Alinhamento — ${label}`}
          className="flex items-center rounded-md border bg-background p-0.5"
        >
          {alignOptions.map((option) => (
            // biome-ignore lint/a11y/useSemanticElements: grupo compacto de 3 ícones lado a lado; um radio nativo por opção quebraria o visual e não teria como colocar só o ícone
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={align === option.key}
              title={option.label}
              onClick={() => onAlignChange(option.key)}
              className={cn(
                "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors",
                align === option.key
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted/60",
              )}
            >
              <option.icon className="size-3.5" />
            </button>
          ))}
        </div>
        <ColorSwatchPicker value={color} onChange={onColorChange} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={size}
          onValueChange={(next) => onSizeChange(next as WidgetTextSize)}
        >
          <SelectTrigger
            className="h-7 w-28 text-xs"
            aria-label={`Tamanho — ${label}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEXT_SIZE_LABEL) as WidgetTextSize[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TEXT_SIZE_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={weight}
          onValueChange={(next) => onWeightChange(next as WidgetTextWeight)}
        >
          <SelectTrigger
            className="h-7 w-28 text-xs"
            aria-label={`Peso — ${label}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEXT_WEIGHT_LABEL) as WidgetTextWeight[]).map(
              (key) => (
                <SelectItem key={key} value={key}>
                  {TEXT_WEIGHT_LABEL[key]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Toggles para som/notificação do alerta + botão "Testar" que dispara o
// popup imediatamente com a mensagem interpolada. Vive num componente para
// isolar os hooks de permissão e não engordar o componente pai.
function AlertNotificationControls({
  alert,
  onChange,
  widgetTitle,
  targetValue,
}: {
  alert: WidgetAlert;
  onChange: (next: WidgetAlert) => void;
  widgetTitle: string;
  targetValue: number;
}) {
  const { permission, request, notify } = useNotificationPermission();
  const [soundArmed, setSoundArmed] = useState(false);

  const previewMessage = (): string => {
    // Valor "de teste" plausível: se o alerta usa a meta, mostra um valor
    // 30% abaixo dela para o placeholder sair coerente; se for número livre,
    // usa o próprio threshold como referência.
    const target =
      alert.useTargetValue && Number.isFinite(targetValue) && targetValue > 0
        ? targetValue
        : alert.threshold;
    const observed =
      alert.comparator === "lt" || alert.comparator === "lte"
        ? target * 0.7
        : target * 1.3;
    return renderAlertMessage(alert.message, {
      valor: formatWidgetValue(observed),
      meta: formatWidgetValue(target),
    });
  };

  const handleTest = () => {
    const message = previewMessage();
    // Toast SEMPRE aparece — é o canal garantido.
    toast.warning(widgetTitle, {
      description: message,
      duration: 8000,
    });
    if (alert.playSound) playAlertSound();
    if (alert.showNotification) notify(widgetTitle, message);
  };

  const handleArmSound = async () => {
    const ok = await primeAlertSound();
    setSoundArmed(ok);
    if (!ok) {
      toast.error("Não foi possível ativar o áudio neste navegador.");
    }
  };

  const handleAskNotification = async () => {
    const result = await request();
    if (result === "denied") {
      toast.error(
        "Notificações do sistema foram bloqueadas. Ajuste as permissões do site no navegador.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-2 border-muted-foreground/20 border-t pt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={alert.playSound}
            onChange={(event) =>
              onChange({ ...alert, playSound: event.target.checked })
            }
          />
          <Volume2 className="size-3.5 text-muted-foreground" />
          Som
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={alert.showNotification}
            onChange={(event) =>
              onChange({ ...alert, showNotification: event.target.checked })
            }
          />
          <BellRing className="size-3.5 text-muted-foreground" />
          Notificação do sistema
        </label>
      </div>

      {/* Priming: áudio precisa de gesto do usuário; notificação precisa de
        permissão. Só mostramos quando o toggle está ligado — assim o usuário
        não recebe pedido irrelevante. */}
      {alert.playSound && !soundArmed && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700">
          <Volume2 className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex-1">
            O navegador bloqueia som sem uma interação antes.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={handleArmSound}
            >
              Ativar áudio nesta aba
            </button>
            .
          </div>
        </div>
      )}
      {alert.showNotification && permission !== "granted" && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700">
          <BellRing className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex-1">
            {permission === "denied"
              ? "Notificações do sistema foram bloqueadas. Reative nas permissões do site."
              : permission === "unsupported"
                ? "Este navegador não suporta notificação do sistema — só o popup dentro da aba funciona."
                : "Precisa conceder permissão."}
            {permission === "default" && (
              <>
                {" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={handleAskNotification}
                >
                  Solicitar permissão
                </button>
                .
              </>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-fit gap-1.5 text-xs"
        onClick={handleTest}
      >
        <PlayCircle className="size-3.5" /> Testar alerta agora
        <span className="text-[10px] text-muted-foreground">
          (usa a mensagem e canais escolhidos)
        </span>
      </Button>
    </div>
  );
}

// Bloco titulado — separa visualmente o que hoje aparece como campos soltos.
// Título discreto (bem próximo dos rótulos de campo), corpo com espaço próprio.
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Campos de personalização de UM widget — compartilhado entre "Adicionar
// widget" (widget-picker-sheet.tsx, antes de criar) e a edição de um widget
// já criado (widget-edit-sheet.tsx), pra não duplicar a UI nos dois lugares.
export function WidgetCustomizeFields({
  entry,
  state,
  onChange,
}: {
  entry: CustomizeEntry;
  state: CustomizeState;
  onChange: (next: Partial<CustomizeState>) => void;
}) {
  const isOracle = entry.key === ORACLE_CUSTOM_KEY;
  const draft = state.oracle ?? EMPTY_ORACLE_DRAFT;
  // Numa consulta customizada quem manda nas formas de exibição possíveis é a
  // própria consulta (1 medida sem agrupamento só pode ser número; N medidas
  // só cabem em tabela), não a entrada estática do catálogo.
  const displayTypes = isOracle
    ? allowedDisplayTypes(draft)
    : entry.supportedDisplayTypes;

  // Placeholder mostra o nome que o widget terá se o campo ficar vazio: para
  // consulta do Oracle, um resumo da própria consulta ("Receita por Filial")
  // em vez do genérico "Consulta personalizada".
  const defaultTitle =
    (isOracle && state.oracle ? describeOracleQuery(state.oracle) : null) ??
    entry.label ??
    "Widget";

  // Meta só faz sentido para alguns cards: aparece quando o widget já tem uma
  // (edição) e do contrário fica escondida atrás de um "Definir meta". Antes
  // ela pulava na tela em todo widget de número — inclusive nos que não têm
  // meta natural (contagens, percentuais, listas de referência) — e virava
  // ruído.
  const hasStoredTarget = state.targetValue.trim().length > 0;
  const [showTarget, setShowTarget] = useState(hasStoredTarget);
  const canHaveTarget = state.displayType === "STAT";
  const targetOpen = canHaveTarget && (showTarget || hasStoredTarget);

  const hasChartKindChoice =
    state.displayType === "CHART" && entry.supportedChartKinds.length > 1;
  const hasDisplayTypeChoice = displayTypes.length > 1;
  const showDisplaySection = hasDisplayTypeChoice || hasChartKindChoice;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Nome">
        <Input
          className="h-8 text-sm"
          placeholder={defaultTitle}
          maxLength={60}
          value={state.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Section>

      {isOracle && (
        <OracleQueryBuilder
          draft={draft}
          displayType={state.displayType}
          onChange={(next) => {
            const allowed = allowedDisplayTypes(next);
            onChange({
              oracle: next,
              // Se a mudança na consulta tornou a exibição atual impossível,
              // corrige em vez de deixar o usuário salvar e tomar erro.
              ...(allowed.includes(state.displayType)
                ? {}
                : { displayType: allowed[0] as DisplayType }),
            });
          }}
          onApplyTemplate={({ config, displayType, name, report }) =>
            onChange({
              oracle: config,
              // Modelo sem `report` (ex.: consulta salva pela org) limpa a
              // derivação anterior — evita ficar com colunas de um modelo
              // diferente do que acabou de ser aplicado.
              report: report ?? null,
              displayType: displayType as DisplayType,
              // Só sugere o nome do modelo se o usuário ainda não digitou o
              // dele — aplicar um modelo não deve apagar o que ele escreveu.
              ...(state.title.trim() ? {} : { title: name }),
            })
          }
        />
      )}

      {showDisplaySection && (
        <Section title="Exibição">
          <div className="flex flex-wrap items-center gap-2">
            {hasDisplayTypeChoice && (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">
                  Formato
                </Label>
                <Select
                  value={state.displayType}
                  onValueChange={(value) =>
                    onChange({ displayType: value as DisplayType })
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {displayTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {DISPLAY_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hasChartKindChoice && (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">
                  Tipo de gráfico
                </Label>
                <Select
                  value={state.chartKind}
                  onValueChange={(value) =>
                    onChange({ chartKind: value as ChartKind })
                  }
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entry.supportedChartKinds.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {CHART_KIND_LABEL[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Aparência">
        <div className="flex flex-col gap-4 rounded-md border bg-muted/20 p-3">
          {/* --- Cor do card e ícone --- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Cor do card
              </Label>
              <ColorSwatchPicker
                value={state.color}
                onChange={(color) => onChange({ color })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-muted-foreground">Ícone</Label>
              <IconSwatchPicker
                value={state.icon}
                onChange={(icon) => onChange({ icon })}
              />
            </div>
          </div>

          {/* --- Moldura: fundo, contorno e cor do contorno --- */}
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] text-muted-foreground">Moldura</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={state.appearance.background}
                onValueChange={(value) =>
                  onChange({
                    appearance: {
                      ...state.appearance,
                      background: value as WidgetBackground,
                    },
                  })
                }
              >
                <SelectTrigger className="h-7 w-36 text-xs" aria-label="Fundo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tint">Fundo colorido</SelectItem>
                  <SelectItem value="none">Sem fundo</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={state.appearance.border}
                onValueChange={(value) =>
                  onChange({
                    appearance: {
                      ...state.appearance,
                      border: value as WidgetBorder,
                    },
                  })
                }
              >
                <SelectTrigger
                  className="h-7 w-36 text-xs"
                  aria-label="Contorno"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Contorno no topo</SelectItem>
                  <SelectItem value="full">Contorno completo</SelectItem>
                  <SelectItem value="none">Sem contorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground">
                Cor do contorno
              </Label>
              <ColorSwatchPicker
                value={state.appearance.borderColor}
                onChange={(borderColor) =>
                  onChange({
                    appearance: { ...state.appearance, borderColor },
                  })
                }
              />
            </div>
          </div>

          {/* --- Texto: título --- */}
          <AppearanceTextRow
            label="Título"
            align={state.appearance.titleAlign}
            color={state.appearance.titleColor}
            size={state.appearance.titleSize}
            weight={state.appearance.titleWeight}
            onAlignChange={(titleAlign) =>
              onChange({
                appearance: { ...state.appearance, titleAlign },
              })
            }
            onColorChange={(titleColor) =>
              onChange({
                appearance: { ...state.appearance, titleColor },
              })
            }
            onSizeChange={(titleSize) =>
              onChange({
                appearance: { ...state.appearance, titleSize },
              })
            }
            onWeightChange={(titleWeight) =>
              onChange({
                appearance: { ...state.appearance, titleWeight },
              })
            }
          />

          {/* --- Texto: valor (só STAT, onde existe um número em destaque) --- */}
          {state.displayType === "STAT" && (
            <AppearanceTextRow
              label="Valor"
              align={state.appearance.valueAlign}
              color={state.appearance.valueColor}
              size={state.appearance.valueSize}
              weight={state.appearance.valueWeight}
              onAlignChange={(valueAlign) =>
                onChange({
                  appearance: { ...state.appearance, valueAlign },
                })
              }
              onColorChange={(valueColor) =>
                onChange({
                  appearance: { ...state.appearance, valueColor },
                })
              }
              onSizeChange={(valueSize) =>
                onChange({
                  appearance: { ...state.appearance, valueSize },
                })
              }
              onWeightChange={(valueWeight) =>
                onChange({
                  appearance: { ...state.appearance, valueWeight },
                })
              }
            />
          )}

          {/* Sempre visível para o conta-gotas estar acessível — se o widget
            ainda não tem ícone, o valor fica guardado e passa a valer no
            momento em que um ícone for escolhido. */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Cor do ícone
            </Label>
            <ColorSwatchPicker
              value={state.appearance.iconColor}
              onChange={(iconColor) =>
                onChange({
                  appearance: { ...state.appearance, iconColor },
                })
              }
            />
            {!state.icon && (
              <p className="text-[10px] text-muted-foreground">
                Escolha um ícone acima para a cor aparecer no card.
              </p>
            )}
          </div>
        </div>
      </Section>

      {canHaveTarget && (
        <Section
          title="Meta"
          aside={
            targetOpen && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
                onClick={() => {
                  onChange({ targetValue: "" });
                  setShowTarget(false);
                }}
              >
                <X className="size-3" /> Remover
              </Button>
            )
          }
        >
          {targetOpen ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 5000"
                className="h-8 w-32 text-sm"
                value={state.targetValue}
                onChange={(event) =>
                  onChange({ targetValue: event.target.value })
                }
              />
              <span className="text-[10px] text-muted-foreground">
                A barra de progresso aparece no card comparando o valor atual à
                meta.
              </span>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-fit gap-1.5 text-xs"
              onClick={() => setShowTarget(true)}
            >
              <Target className="size-3.5" /> Definir meta
              <span className="text-[10px] text-muted-foreground">
                (opcional)
              </span>
            </Button>
          )}
        </Section>
      )}

      {/* --- Alerta (só STAT: o comparador exige um número único) --- */}
      {canHaveTarget && (
        <Section
          title="Alerta"
          aside={
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={state.alert.enabled}
                onChange={(event) =>
                  onChange({
                    alert: { ...state.alert, enabled: event.target.checked },
                  })
                }
                className="size-3.5"
              />
              Ativado
            </label>
          }
        >
          {state.alert.enabled && (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
              {/* --- Condição --- */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Quando o valor for
                  </Label>
                  <Select
                    value={state.alert.comparator}
                    onValueChange={(next) =>
                      onChange({
                        alert: {
                          ...state.alert,
                          comparator: next as WidgetAlertComparator,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPARATOR_OPTIONS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Referência
                  </Label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={state.alert.useTargetValue}
                        onChange={(event) =>
                          onChange({
                            alert: {
                              ...state.alert,
                              useTargetValue: event.target.checked,
                            },
                          })
                        }
                      />
                      Usar Meta
                    </label>
                    {!state.alert.useTargetValue && (
                      <Input
                        type="number"
                        step="any"
                        className="h-8 w-28 text-xs"
                        value={state.alert.threshold}
                        onChange={(event) =>
                          onChange({
                            alert: {
                              ...state.alert,
                              threshold: Number(event.target.value) || 0,
                            },
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* --- Quando disparar --- */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Horário
                  </Label>
                  <Input
                    type="time"
                    className="h-8 w-28 text-xs"
                    value={state.alert.time}
                    onChange={(event) =>
                      onChange({
                        alert: { ...state.alert, time: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Dias da semana
                  </Label>
                  <WeekdayPicker
                    value={state.alert.daysOfWeek}
                    onChange={(daysOfWeek) =>
                      onChange({
                        alert: { ...state.alert, daysOfWeek },
                      })
                    }
                  />
                </div>
              </div>

              {/* --- Mensagem + cor do card em alerta --- */}
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">
                  Mensagem (usa {`{{valor}}`} e {`{{meta}}`})
                </Label>
                <Input
                  className="h-8 text-xs"
                  maxLength={200}
                  value={state.alert.message}
                  onChange={(event) =>
                    onChange({
                      alert: { ...state.alert, message: event.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] text-muted-foreground">
                  Cor do card em alerta
                </Label>
                <ColorSwatchPicker
                  value={state.alert.color}
                  onChange={(color) =>
                    onChange({ alert: { ...state.alert, color } })
                  }
                />
              </div>

              <AlertNotificationControls
                alert={state.alert}
                onChange={(next) => onChange({ alert: next })}
                widgetTitle={state.title || "Widget"}
                targetValue={Number(state.targetValue.replace(",", "."))}
              />

              <p className="text-[10px] text-muted-foreground">
                O cron do servidor roda a cada 5 min entre 6h e 22h. Um alerta
                configurado para 14h dispara uma vez por dia, dentro dessa
                janela, sem chamadas do cliente.
              </p>
            </div>
          )}

          {!state.alert.enabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-fit gap-1.5 text-xs"
              onClick={() =>
                onChange({ alert: { ...DEFAULT_ALERT, enabled: true } })
              }
            >
              <Target className="size-3.5" /> Configurar alerta
              <span className="text-[10px] text-muted-foreground">
                (server-side, sem polling)
              </span>
            </Button>
          )}
        </Section>
      )}
    </div>
  );
}

// Grupo compacto de 7 botões (D-S-T-Q-Q-S-S) para escolher dias da semana.
function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const days = ["D", "S", "T", "Q", "Q", "S", "S"];
  const set = new Set(value);
  return (
    <div className="flex items-center gap-1">
      {days.map((label, index) => {
        const active = set.has(index);
        return (
          <button
            key={index}
            type="button"
            title={
              [
                "Domingo",
                "Segunda",
                "Terça",
                "Quarta",
                "Quinta",
                "Sexta",
                "Sábado",
              ][index]
            }
            onClick={() => {
              const next = new Set(set);
              if (active) next.delete(index);
              else next.add(index);
              onChange([...next].sort());
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border font-medium text-[10px] transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
