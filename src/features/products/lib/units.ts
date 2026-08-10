// Rótulos curtos das unidades cadastradas do produto (ProductUnit). Usado no
// PDV/histórico pra mostrar ao lado do nome — deixa claro se é kg, un, m, etc.
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
