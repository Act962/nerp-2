/**
 * Horário de parede da agenda ↔ instante em UTC.
 *
 * A grade da agenda é escrita em hora de parede ("08:00 às 12:00"), mas o
 * compromisso é gravado como instante. Converter nos dois sentidos é o que
 * mantém "09:00" significando nove da manhã na loja, e não nove em UTC — que
 * seria seis da manhã e apareceria no dia anterior nas bordas.
 *
 * O fuso é o mesmo que as vendas (`STORE_TZ`), os alertas (`ALERT_TZ`) e os
 * crons usam. Está declarado aqui, e não importado de lá, seguindo o que o
 * resto do projeto já faz — cada módulo declara o seu. Quando existir
 * organização fora deste fuso, isto vira coluna em `Organization` e os quatro
 * pontos passam a ler dela.
 */
export const FUSO_DA_AGENDA = "America/Fortaleza";

/** "HH:MM" → minutos desde a meia-noite. `null` se o formato não bater. */
export function emMinutos(hora: string): number | null {
  const casou = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!casou) return null;
  const h = Number(casou[1]);
  const m = Number(casou[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Minutos desde a meia-noite → "HH:MM". */
export function emHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Quanto o fuso está deslocado de UTC no instante dado, em milissegundos.
 *
 * Formata o instante no fuso alvo e reinterpreta os componentes como se fossem
 * UTC: a diferença para o instante original é o offset. Sem tabela de fusos
 * própria e sem dependência nova.
 */
function offsetMs(instante: Date, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instante);

  const pegar = (tipo: string) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);

  const comoUtc = Date.UTC(
    pegar("year"),
    pegar("month") - 1,
    pegar("day"),
    pegar("hour"),
    pegar("minute"),
    pegar("second"),
  );

  return comoUtc - instante.getTime();
}

/**
 * "2026-09-02" + 540 minutos → o instante em que é 09:00 na loja naquele dia.
 *
 * O offset é calculado a partir de uma estimativa e reaplicado: em fuso sem
 * horário de verão (o caso do Brasil hoje) a primeira conta já acerta, e a
 * segunda passada é o que evitaria errar por uma hora numa virada de DST.
 */
export function paredeParaUtc(
  data: string,
  minutosDoDia: number,
  fuso: string = FUSO_DA_AGENDA,
): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, 0, minutosDoDia);

  const primeiraTentativa = new Date(
    comoSeFosseUtc - offsetMs(new Date(comoSeFosseUtc), fuso),
  );
  return new Date(comoSeFosseUtc - offsetMs(primeiraTentativa, fuso));
}

/** O instante, escrito como o relógio da loja marca: `{ data, minutos }`. */
export function paredeDoInstante(
  instante: Date,
  fuso: string = FUSO_DA_AGENDA,
): { data: string; minutos: number } {
  const parede = new Date(instante.getTime() + offsetMs(instante, fuso));
  const data = parede.toISOString().slice(0, 10);
  return {
    data,
    minutos: parede.getUTCHours() * 60 + parede.getUTCMinutes(),
  };
}

/** Dia da semana no fuso da loja, no formato do enum `DayOfWeek`. */
export const DIAS_DA_SEMANA = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type DiaDaSemana = (typeof DIAS_DA_SEMANA)[number];

export function diaDaSemanaDaData(data: string): DiaDaSemana {
  const [ano, mes, dia] = data.split("-").map(Number);
  // A data é só um rótulo de calendário; `Date.UTC` evita que o fuso da
  // máquina jogue o dia para o anterior.
  return DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
}

export type Faixa = { startTime: string; endTime: string };

export type Encaixe = {
  /** "HH:MM" na parede da loja. */
  inicio: string;
  fim: string;
  /** Instante do início — é o que vai para `Appointment.startsAt`. */
  instante: Date;
  ocupado: boolean;
  passado: boolean;
};

/**
 * Quebra as faixas do dia em encaixes de `duracaoMin`.
 *
 * O encaixe precisa caber **inteiro** dentro da faixa: uma faixa 08:00–12:00
 * com encaixe de 60 min termina em 11:00–12:00, não oferece 12:00. O Órbita
 * oferece — o comentário de lá diz que foi pedido assim —, e o resultado é um
 * compromisso das 12:00 às 13:00 marcado por quem anunciou que atende até as
 * 12:00. Aqui a faixa vale o que está escrito.
 *
 * Encaixe que colide com compromisso existente sai marcado `ocupado`, e não
 * some: some é o que faz o cliente achar que a agenda está vazia num dia cheio.
 * Quem decide esconder é a tela.
 */
export function gerarEncaixes(input: {
  data: string;
  duracaoMin: number;
  faixas: Faixa[];
  ocupados: { startsAt: Date; endsAt: Date }[];
  agora?: Date;
  fuso?: string;
}): Encaixe[] {
  const fuso = input.fuso ?? FUSO_DA_AGENDA;
  const agora = input.agora ?? new Date();
  const duracao = Math.max(1, Math.trunc(input.duracaoMin));

  const encaixes: Encaixe[] = [];
  const jaVistos = new Set<string>();

  for (const faixa of input.faixas) {
    const inicio = emMinutos(faixa.startTime);
    const fim = emMinutos(faixa.endTime);
    if (inicio === null || fim === null || fim <= inicio) continue;

    for (let m = inicio; m + duracao <= fim; m += duracao) {
      const hora = emHora(m);
      // Duas faixas que se sobrepõem gerariam o mesmo horário duas vezes.
      if (jaVistos.has(hora)) continue;
      jaVistos.add(hora);

      const comeca = paredeParaUtc(input.data, m, fuso);
      const termina = new Date(comeca.getTime() + duracao * 60_000);

      encaixes.push({
        inicio: hora,
        fim: emHora(m + duracao),
        instante: comeca,
        ocupado: input.ocupados.some(
          (ocupado) => comeca < ocupado.endsAt && termina > ocupado.startsAt,
        ),
        passado: comeca.getTime() <= agora.getTime(),
      });
    }
  }

  return encaixes.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
