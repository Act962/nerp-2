// Rótulos curtos das unidades cadastradas do produto (ProductUnit). Usado no
// PDV pra mostrar ao lado do nome — o operador sabe se digita em kg, un, m, etc.
const UNIT_LABELS: Record<string, string> = {
  UN: "un",
  KG: "kg",
  G: "g",
  L: "L",
  ML: "mL",
  M: "m",
  M2: "m²",
  M3: "m³",
  CX: "cx",
  PC: "pç",
  PAR: "par",
  DZ: "dz",
};

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "un";
  return UNIT_LABELS[unit] ?? unit.toLowerCase();
}

// Unidades que aceitam quantidade fracionada (kg, g, litro, mililitro, metros).
// Peça/caixa/par/dúzia são sempre inteiras.
export function unitAllowsDecimal(unit: string | null | undefined): boolean {
  if (!unit) return false;
  return ["KG", "G", "L", "ML", "M", "M2", "M3"].includes(unit);
}
