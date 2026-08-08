// Módulo puro (server + client): definição dos atalhos do PDV, resolução de
// overrides da org e normalização de teclas. Sem "use client" de propósito — o
// router valida os mesmos ids/teclas.

export type PdvActionId =
  | "abrir-caixa"
  | "finalizar-venda"
  | "buscar-produto"
  | "selecionar-cliente"
  | "limpar-carrinho"
  | "ajuda-atalhos";

export interface PdvShortcutDef {
  id: PdvActionId;
  label: string;
  /** Tecla padrão, no formato de `keyFromEvent` (ex.: "F8", "Ctrl+K"). */
  defaultKey: string;
}

// Padrões de fábrica. O admin da org pode sobrescrever cada tecla.
export const PDV_SHORTCUTS: PdvShortcutDef[] = [
  { id: "abrir-caixa", label: "Abrir caixa", defaultKey: "F8" },
  {
    id: "finalizar-venda",
    label: "Finalizar venda (pagamento)",
    defaultKey: "F2",
  },
  { id: "buscar-produto", label: "Focar busca de produto", defaultKey: "F3" },
  { id: "selecionar-cliente", label: "Selecionar cliente", defaultKey: "F6" },
  { id: "limpar-carrinho", label: "Limpar carrinho", defaultKey: "F4" },
  { id: "ajuda-atalhos", label: "Ver/editar atalhos", defaultKey: "F1" },
];

export const PDV_ACTION_IDS = PDV_SHORTCUTS.map((s) => s.id);

export type PdvBindings = Record<PdvActionId, string>;

// Aceita "F1".."F12" ou um caractere visível, com modificadores opcionais.
export const SHORTCUT_KEY_PATTERN =
  /^(Ctrl\+)?(Alt\+)?(Shift\+)?(F([1-9]|1[0-2])|[A-Z0-9])$/;

export function isValidShortcutKey(key: string): boolean {
  return SHORTCUT_KEY_PATTERN.test(key);
}

// Mescla os padrões com os overrides da org (ignora chaves/valores inválidos).
export function resolveBindings(
  overrides?: Partial<Record<string, unknown>> | null,
): PdvBindings {
  const result = {} as PdvBindings;
  for (const shortcut of PDV_SHORTCUTS) {
    const override = overrides?.[shortcut.id];
    result[shortcut.id] =
      typeof override === "string" && isValidShortcutKey(override)
        ? override
        : shortcut.defaultKey;
  }
  return result;
}

// Normaliza um KeyboardEvent no mesmo formato das teclas configuradas.
export function keyFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const key = /^F([1-9]|1[0-2])$/.test(event.key)
    ? event.key
    : event.key.length === 1
      ? event.key.toUpperCase()
      : event.key;
  parts.push(key);
  return parts.join("+");
}

// Um atalho sem modificador e sem F-key não deve "roubar" a digitação de um
// campo de texto (a busca do PDV fica sempre focada). F-keys e combos com
// Ctrl/Alt disparam mesmo com o input focado.
export function bindingFiresInInputs(binding: string): boolean {
  return /F([1-9]|1[0-2])/.test(binding) || /Ctrl|Alt/.test(binding);
}
