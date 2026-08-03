import dayjs, { type Dayjs } from "dayjs";
import type { CommemorativeDate } from "./commemorative-types";

/**
 * Feriados nacionais e datas comemorativas fixas, por "MM-DD".
 *
 * Guarda ARRAY por dia: 15/03 é Dia do Consumidor e Dia da Escola; um valor
 * único faria a segunda sobrescrever a primeira em silêncio.
 */
export const FIXED_DATES: Record<string, CommemorativeDate[]> = {
  "01-01": [
    {
      id: "feriado-confraternizacao",
      label: "🎉 Confraternização",
      title: "Confraternização Universal",
      description: "Feriado nacional. Ano-novo.",
      impact:
        "Lojas fechadas ou em horário reduzido; movimento se concentra na véspera.",
      tips: ["Garanta reposição em 30/12", "Confirme a escala do dia 31"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "01-25": [
    {
      id: "gastro-cafe",
      label: "☕ Dia do Café",
      title: "Dia Nacional do Café",
      description: "Data forte para a categoria de matinais.",
      impact:
        "Boa janela para degustação e ponta de gôndola de cafés e achocolatados.",
      tips: [
        "Monte ilha com café + biscoito",
        "Negocie degustação com a indústria",
      ],
      kind: "GASTRONOMICA",
    },
  ],
  "03-08": [
    {
      id: "data-mulher",
      label: "💜 Dia da Mulher",
      title: "Dia Internacional da Mulher",
      description: "Data de forte apelo em perfumaria e presentes.",
      impact: "Sobe a saída de perfumaria, cuidados pessoais e floricultura.",
      tips: [
        "Destaque perfumaria na entrada",
        "Kits de presente na frente de caixa",
      ],
      kind: "DATA_COMEMORATIVA",
    },
  ],
  "03-15": [
    {
      id: "varejo-consumidor",
      label: "🛒 Dia do Consumidor",
      title: "Dia Mundial do Consumidor",
      description: "Semana de ofertas — a 'Black Friday do primeiro semestre'.",
      impact: "Semana inteira de promoção; concorrência agressiva em preço.",
      tips: [
        "Confira preço na gôndola x tabloide",
        "Reforce estoque dos itens do encarte",
      ],
      kind: "VAREJO",
    },
  ],
  "04-21": [
    {
      id: "feriado-tiradentes",
      label: "🇧🇷 Tiradentes",
      title: "Tiradentes",
      description: "Feriado nacional.",
      impact:
        "Feriado prolongado quando cai perto do fim de semana; sobe churrasco e bebidas.",
      tips: [
        "Antecipe reposição de carnes e bebidas",
        "Cheque a escala de véspera",
      ],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "05-01": [
    {
      id: "feriado-trabalho",
      label: "🛠️ Dia do Trabalho",
      title: "Dia do Trabalho",
      description: "Feriado nacional.",
      impact:
        "Muitas lojas em horário reduzido; véspera concentra o movimento.",
      tips: ["Garanta gôndola cheia na véspera"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "06-12": [
    {
      id: "data-namorados",
      label: "💕 Namorados",
      title: "Dia dos Namorados",
      description: "Data de presente, vinhos, chocolates e sobremesas.",
      impact: "Pico em chocolate, espumante, vinho e sobremesas prontas.",
      tips: [
        "Ilha temática 7 dias antes",
        "Cross-merchandising vinho + chocolate",
      ],
      kind: "DATA_COMEMORATIVA",
    },
  ],
  "06-24": [
    {
      id: "data-sao-joao",
      label: "🔥 São João",
      title: "Festas Juninas — São João",
      description: "Data regional muito forte no Nordeste.",
      impact:
        "Explode milho, amendoim, canjica, licor, bebidas e itens de festa.",
      tips: [
        "Monte a ilha junina no início de junho",
        "Reforce amendoim e milho",
      ],
      kind: "DATA_COMEMORATIVA",
    },
  ],
  "07-10": [
    {
      id: "gastro-pizza",
      label: "🍕 Dia da Pizza",
      title: "Dia Nacional da Pizza",
      description: "Data de congelados e da categoria de massas.",
      impact: "Sobe pizza congelada, queijo, molho de tomate e refrigerante.",
      tips: [
        "Cross-merchandising pizza + refrigerante",
        "Cheque validade do congelado",
      ],
      kind: "GASTRONOMICA",
    },
  ],
  "09-07": [
    {
      id: "feriado-independencia",
      label: "🇧🇷 Independência",
      title: "Independência do Brasil",
      description: "Feriado nacional.",
      impact: "Feriado prolongado frequente; sobe churrasco e bebidas.",
      tips: ["Reforce carnes, carvão e cerveja na véspera"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "09-15": [
    {
      id: "varejo-cliente",
      label: "🤝 Dia do Cliente",
      title: "Dia do Cliente",
      description: "Data de relacionamento e ofertas no varejo.",
      impact: "Ações de fidelidade e cupom; bom momento para degustação.",
      tips: [
        "Combine com ação de app/fidelidade",
        "Degustação nas marcas foco",
      ],
      kind: "VAREJO",
    },
  ],
  "10-12": [
    {
      id: "feriado-aparecida",
      label: "🙏 N. Sra. Aparecida",
      title: "Nossa Senhora Aparecida",
      description: "Feriado nacional religioso.",
      impact: "Feriado prolongado; movimento concentrado na véspera.",
      tips: ["Garanta reposição na véspera"],
      kind: "FERIADO_NACIONAL",
    },
    {
      id: "data-criancas",
      label: "🧸 Dia das Crianças",
      title: "Dia das Crianças",
      description: "Data de presente, brinquedo e guloseimas.",
      impact:
        "Pico em chocolate, biscoito, salgadinho, achocolatado e brinquedo.",
      tips: [
        "Ilha de guloseimas na altura da criança",
        "Combo lanche + brinde",
      ],
      kind: "DATA_COMEMORATIVA",
    },
  ],
  "11-02": [
    {
      id: "feriado-finados",
      label: "🕯️ Finados",
      title: "Finados",
      description: "Feriado nacional.",
      impact: "Movimento menor; floricultura em alta.",
      tips: ["Ajuste a escala — dia de baixo fluxo"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "11-15": [
    {
      id: "feriado-republica",
      label: "🇧🇷 Proclamação",
      title: "Proclamação da República",
      description: "Feriado nacional.",
      impact: "Feriado prolongado comum; véspera de Black Friday.",
      tips: ["Aproveite para montar a Black Friday"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "11-20": [
    {
      id: "feriado-consciencia-negra",
      label: "✊🏿 Consciência Negra",
      title: "Dia Nacional de Zumbi e da Consciência Negra",
      description: "Feriado nacional.",
      impact: "Feriado em boa parte do país, na semana da Black Friday.",
      tips: ["Confira a escala — cai na semana da Black Friday"],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "12-24": [
    {
      id: "data-vespera-natal",
      label: "🎄 Véspera de Natal",
      title: "Véspera de Natal",
      description: "O maior dia de faturamento do ano no supermercado.",
      impact: "Pico absoluto de fluxo; ruptura é o maior risco do ano.",
      tips: ["Reponha várias vezes ao dia", "Foto de gôndola cheia logo cedo"],
      kind: "DATA_COMEMORATIVA",
    },
  ],
  "12-25": [
    {
      id: "feriado-natal",
      label: "🎅 Natal",
      title: "Natal",
      description: "Feriado nacional.",
      impact: "Maioria das lojas fechada; a venda aconteceu na véspera.",
      tips: [],
      kind: "FERIADO_NACIONAL",
    },
  ],
  "12-31": [
    {
      id: "data-reveillon",
      label: "🥂 Réveillon",
      title: "Véspera de Ano-Novo",
      description: "Segunda maior data de faturamento do ano.",
      impact: "Pico em espumante, cerveja, carnes e descartáveis.",
      tips: ["Reforce espumante e gelo", "Ponta de gôndola de bebidas"],
      kind: "DATA_COMEMORATIVA",
    },
  ],
};

/** Enésimo dia-da-semana de um mês. Ex.: 2º domingo de maio. */
function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): string {
  const first = dayjs(new Date(year, month - 1, 1));
  const offset = (weekday - first.day() + 7) % 7;
  return first.add(offset + (nth - 1) * 7, "day").format("YYYY-MM-DD");
}

/** Último dia-da-semana de um mês. Ex.: última sexta de novembro. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = dayjs(new Date(year, month, 0));
  const offset = (last.day() - weekday + 7) % 7;
  return last.subtract(offset, "day").format("YYYY-MM-DD");
}

/** Domingo de Páscoa — computus gregoriano anônimo. */
function easterDate(year: number): Dayjs {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayjs(new Date(year, month - 1, day));
}

/**
 * Datas móveis, por "YYYY-MM-DD".
 *
 * TUDO aqui é calculado, nada é literal de ano. Uma lista chumbada de "Carnaval
 * 2026" simplesmente desaparece em 2027 sem ninguém perceber.
 */
export function buildVariableDates(
  years: Set<number>,
): Record<string, CommemorativeDate[]> {
  const map: Record<string, CommemorativeDate[]> = {};
  const push = (key: string, date: CommemorativeDate) => {
    const list = map[key];
    if (list) list.push(date);
    else map[key] = [date];
  };

  for (const year of years) {
    const easter = easterDate(year);

    // Terça-feira de Carnaval = Páscoa − 47 (a quarta de cinzas é −46).
    push(easter.subtract(47, "day").format("YYYY-MM-DD"), {
      id: `data-carnaval-${year}`,
      label: "🎭 Carnaval",
      title: "Carnaval",
      description: "Ponto facultativo na maior parte do país.",
      impact:
        "Antes: pico de bebida, gelo e descartável. Durante: fluxo cai em cidade de origem, sobe em litoral.",
      tips: [
        "Reforce cerveja e gelo na semana anterior",
        "Ajuste a escala de campo",
      ],
      kind: "DATA_COMEMORATIVA",
    });

    push(easter.subtract(2, "day").format("YYYY-MM-DD"), {
      id: `feriado-sexta-santa-${year}`,
      label: "✝️ Sexta-feira Santa",
      title: "Sexta-feira da Paixão",
      description: "Feriado nacional.",
      impact: "Pico de pescado, bacalhau e azeite na semana.",
      tips: [
        "Monte a ilha de pescado na segunda anterior",
        "Cheque validade do bacalhau",
      ],
      kind: "FERIADO_NACIONAL",
    });

    push(easter.format("YYYY-MM-DD"), {
      id: `data-pascoa-${year}`,
      label: "🐣 Páscoa",
      title: "Páscoa",
      description: "Uma das maiores datas de chocolate do ano.",
      impact: "Coelho/ovo de Páscoa domina a loja nas 6 semanas anteriores.",
      tips: [
        "Foto do túnel de Páscoa toda semana",
        "Acompanhe ruptura de ovos",
      ],
      kind: "DATA_COMEMORATIVA",
    });

    push(easter.add(60, "day").format("YYYY-MM-DD"), {
      id: `feriado-corpus-christi-${year}`,
      label: "⛪ Corpus Christi",
      title: "Corpus Christi",
      description: "Ponto facultativo com feriado prolongado frequente.",
      impact: "Emenda comum com a sexta; sobe churrasco e bebidas.",
      tips: ["Reforce a véspera"],
      kind: "FERIADO_NACIONAL",
    });

    push(nthWeekday(year, 5, 0, 2), {
      id: `data-maes-${year}`,
      label: "💐 Dia das Mães",
      title: "Dia das Mães",
      description: "A maior data comercial do primeiro semestre.",
      impact: "Pico em perfumaria, chocolate, vinho, flores e sobremesa.",
      tips: [
        "Ilha de presente 2 semanas antes",
        "Cross-merchandising perfumaria + chocolate",
      ],
      kind: "DATA_COMEMORATIVA",
    });

    push(nthWeekday(year, 8, 0, 2), {
      id: `data-pais-${year}`,
      label: "👔 Dia dos Pais",
      title: "Dia dos Pais",
      description: "Data de churrasco, cerveja e presente.",
      impact: "Sobe carne, cerveja, destilado e utilidades de churrasco.",
      tips: ["Combo carne + carvão + cerveja", "Reforce destilados"],
      kind: "DATA_COMEMORATIVA",
    });

    const blackFriday = lastWeekday(year, 11, 5);
    push(blackFriday, {
      id: `varejo-black-friday-${year}`,
      label: "🛍️ Black Friday",
      title: "Black Friday",
      description: "Última sexta-feira de novembro.",
      impact:
        "Maior data promocional do ano; risco alto de ruptura e de preço errado na gôndola.",
      tips: [
        "Confira etiqueta x sistema logo cedo",
        "Foto de antes e depois da ação",
      ],
      kind: "VAREJO",
    });
    push(dayjs(blackFriday).add(3, "day").format("YYYY-MM-DD"), {
      id: `varejo-cyber-monday-${year}`,
      label: "💻 Cyber Monday",
      title: "Cyber Monday",
      description: "Segunda-feira seguinte à Black Friday.",
      impact: "Prolonga a promoção; foco em não-alimentos.",
      tips: ["Verifique reposição do que vendeu na sexta"],
      kind: "VAREJO",
    });
  }

  return map;
}
