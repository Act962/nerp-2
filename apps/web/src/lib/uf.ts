/**
 * Unidade federativa em duas letras.
 *
 * Existe porque as fontes discordam: o OpenStreetMap devolve "Piauí" por
 * extenso, planilha de cliente costuma trazer "PI". Sem normalizar, o mesmo
 * estado vira duas linhas na contagem de mercado — e a faixa pública mostra
 * "PI 1958 · Piauí 29", que parece defeito porque é.
 */
const BY_NAME: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const UF_CODES = new Set(Object.values(BY_NAME));

export function normalizeUf(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  const upper = raw.toUpperCase();
  if (upper.length === 2 && UF_CODES.has(upper)) return upper;

  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // Desconhecido volta como veio: perder o dado seria pior que guardá-lo
  // fora do padrão, e ele fica visível na fila de conferência.
  return BY_NAME[key] ?? raw;
}
