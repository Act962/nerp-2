"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  BlockAlign,
  BlockSize,
  ReceiptBlock,
  ReceiptBlockKind,
} from "../lib/types";
import { AVAILABLE_VARIABLES } from "../lib/variables";

export const BLOCK_LABELS: Record<ReceiptBlockKind, string> = {
  logo: "Logo",
  header: "Cabeçalho",
  text: "Texto",
  items: "Itens",
  totals: "Totais",
  qr: "QR Code",
  link: "Link",
  divider: "Divisória",
  spacer: "Espaço",
};

// Cria um bloco novo com valores padrão (id via randomUUID).
export function makeBlock(kind: ReceiptBlockKind): ReceiptBlock {
  const id = crypto.randomUUID();
  switch (kind) {
    case "logo":
      return { id, kind, align: "center", size: "md" };
    case "header":
      return {
        id,
        kind,
        align: "center",
        showName: true,
        showDocument: true,
        showAddress: true,
        showPhone: true,
      };
    case "text":
      return {
        id,
        kind,
        value: "Novo texto",
        align: "left",
        bold: false,
        size: "md",
      };
    case "items":
      return { id, kind, showSku: false, showUnitPrice: true };
    case "totals":
      return {
        id,
        kind,
        showSubtotal: true,
        showDiscount: true,
        showPayments: true,
        showChange: true,
      };
    case "qr":
      return { id, kind, source: "pix", value: "", caption: "", size: "md" };
    case "link":
      return { id, kind, label: "Nosso site", url: "https://" };
    case "divider":
      return { id, kind, style: "dashed" };
    case "spacer":
      return { id, kind };
  }
}

const ALIGN_OPTIONS: { value: BlockAlign; label: string }[] = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

const SIZE_OPTIONS: { value: BlockSize; label: string }[] = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
];

function AlignField({
  value,
  onChange,
}: {
  value: BlockAlign;
  onChange: (v: BlockAlign) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">Alinhamento</Label>
      <Select value={value} onValueChange={(v) => onChange(v as BlockAlign)}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALIGN_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SizeField({
  value,
  onChange,
}: {
  value: BlockSize;
  onChange: (v: BlockSize) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">Tamanho</Label>
      <Select value={value} onValueChange={(v) => onChange(v as BlockSize)}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SIZE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const VARIABLE_HINT = `Variáveis: ${AVAILABLE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}`;

// Renderiza os campos de edição de um bloco. `onChange` recebe um patch parcial
// já estreitado para o tipo do bloco.
export function BlockFields({
  block,
  onChange,
}: {
  block: ReceiptBlock;
  onChange: (patch: Partial<ReceiptBlock>) => void;
}) {
  switch (block.kind) {
    case "logo":
      return (
        <div className="grid grid-cols-2 gap-3">
          <AlignField
            value={block.align}
            onChange={(align) => onChange({ align })}
          />
          <SizeField
            value={block.size}
            onChange={(size) => onChange({ size })}
          />
        </div>
      );
    case "header":
      return (
        <div className="flex flex-col gap-2">
          <AlignField
            value={block.align}
            onChange={(align) => onChange({ align })}
          />
          <ToggleRow
            label="Nome da loja"
            checked={block.showName}
            onChange={(showName) => onChange({ showName })}
          />
          <ToggleRow
            label="CNPJ / documento"
            checked={block.showDocument}
            onChange={(showDocument) => onChange({ showDocument })}
          />
          <ToggleRow
            label="Endereço"
            checked={block.showAddress}
            onChange={(showAddress) => onChange({ showAddress })}
          />
          <ToggleRow
            label="Telefone"
            checked={block.showPhone}
            onChange={(showPhone) => onChange({ showPhone })}
          />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-2">
          <Textarea
            value={block.value}
            onChange={(e) => onChange({ value: e.target.value })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">{VARIABLE_HINT}</p>
          <div className="grid grid-cols-2 gap-3">
            <AlignField
              value={block.align}
              onChange={(align) => onChange({ align })}
            />
            <SizeField
              value={block.size}
              onChange={(size) => onChange({ size })}
            />
          </div>
          <ToggleRow
            label="Negrito"
            checked={block.bold}
            onChange={(bold) => onChange({ bold })}
          />
        </div>
      );
    case "items":
      return (
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Mostrar SKU"
            checked={block.showSku}
            onChange={(showSku) => onChange({ showSku })}
          />
          <ToggleRow
            label="Mostrar preço unitário"
            checked={block.showUnitPrice}
            onChange={(showUnitPrice) => onChange({ showUnitPrice })}
          />
        </div>
      );
    case "totals":
      return (
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Subtotal"
            checked={block.showSubtotal}
            onChange={(showSubtotal) => onChange({ showSubtotal })}
          />
          <ToggleRow
            label="Desconto"
            checked={block.showDiscount}
            onChange={(showDiscount) => onChange({ showDiscount })}
          />
          <ToggleRow
            label="Pagamentos"
            checked={block.showPayments}
            onChange={(showPayments) => onChange({ showPayments })}
          />
          <ToggleRow
            label="Troco"
            checked={block.showChange}
            onChange={(showChange) => onChange({ showChange })}
          />
        </div>
      );
    case "qr":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select
              value={block.source}
              onValueChange={(v) =>
                onChange({ source: v as "pix" | "nfce" | "custom" })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX (copia-e-cola)</SelectItem>
                <SelectItem value="nfce">NFC-e (URL de consulta)</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.source === "custom" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Conteúdo</Label>
              <Input
                value={block.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="Texto ou URL do QR"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Legenda</Label>
            <Input
              value={block.caption}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </div>
          <SizeField
            value={block.size}
            onChange={(size) => onChange({ size })}
          />
        </div>
      );
    case "link":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Rótulo</Label>
            <Input
              value={block.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">URL</Label>
            <Input
              value={block.url}
              onChange={(e) => onChange({ url: e.target.value })}
            />
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Estilo</Label>
          <Select
            value={block.style}
            onValueChange={(v) => onChange({ style: v as "solid" | "dashed" })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Sólida</SelectItem>
              <SelectItem value="dashed">Tracejada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "spacer":
      return (
        <p className="text-xs text-muted-foreground">
          Espaço em branco (sem configuração).
        </p>
      );
    default:
      return null;
  }
}
