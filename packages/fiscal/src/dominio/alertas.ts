export type NivelAlerta = "critico" | "aviso" | "info";

export type AlertaFiscal = {
  tipo:
    | "CERTIFICADO"
    | "REJEICAO_RECORRENTE"
    | "NOTAS_PARADAS"
    | "NUMEROS_PULADOS";
  nivel: NivelAlerta;
  mensagem: string;
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Mesma rejeição três vezes num dia é cadastro errado, não azar. */
export const LIMITE_REJEICAO_RECORRENTE = 3;

const ORDEM: Record<NivelAlerta, number> = { critico: 0, aviso: 1, info: 2 };

function data(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}

/**
 * O que a empresa precisa resolver para continuar emitindo, do mais grave ao
 * mais leve. Função pura: quem chama junta os números do banco.
 *
 * Certificado avisa em 30, 15 e 7 dias: A1 vence em um ano, a renovação
 * depende de agendar com a certificadora, e certificado vencido para a emissão
 * no meio do expediente.
 */
export function alertasFiscais(input: {
  agora: Date;
  certificadoVenceEm: Date | null;
  /** Rejeições das últimas 24 horas. */
  rejeicoesRecentes: { codigo: string; motivo: string }[];
  /** Notas sem desfecho há mais tempo que o normal. */
  paradas: number;
  /** Quantidade de números pulados aguardando inutilização. */
  pulados: number;
}): AlertaFiscal[] {
  const alertas: AlertaFiscal[] = [];

  if (input.certificadoVenceEm) {
    const dias = Math.ceil(
      (input.certificadoVenceEm.getTime() - input.agora.getTime()) / DIA_MS,
    );
    const quando = data(input.certificadoVenceEm);
    if (dias <= 0)
      alertas.push({
        tipo: "CERTIFICADO",
        nivel: "critico",
        mensagem: `O certificado digital venceu em ${quando}. A SEFAZ recusa nota assinada com ele — renove e envie o novo arquivo.`,
      });
    else if (dias <= 30)
      alertas.push({
        tipo: "CERTIFICADO",
        nivel: dias <= 7 ? "critico" : dias <= 15 ? "aviso" : "info",
        mensagem: `O certificado digital vence em ${dias} ${dias === 1 ? "dia" : "dias"} (${quando}). Agende a renovação com a certificadora.`,
      });
  }

  const porCodigo = new Map<string, { motivo: string; vezes: number }>();
  for (const r of input.rejeicoesRecentes) {
    const atual = porCodigo.get(r.codigo);
    porCodigo.set(r.codigo, {
      motivo: atual?.motivo ?? r.motivo,
      vezes: (atual?.vezes ?? 0) + 1,
    });
  }
  for (const [codigo, { motivo, vezes }] of porCodigo)
    if (vezes >= LIMITE_REJEICAO_RECORRENTE)
      alertas.push({
        tipo: "REJEICAO_RECORRENTE",
        nivel: "aviso",
        mensagem: `A rejeição ${codigo} aconteceu ${vezes} vezes nas últimas 24 horas: ${motivo}. Revise o cadastro fiscal.`,
      });

  if (input.paradas > 0)
    alertas.push({
      tipo: "NOTAS_PARADAS",
      nivel: "aviso",
      mensagem: `${input.paradas} ${input.paradas === 1 ? "nota está" : "notas estão"} sem resposta do emissor há mais de 15 minutos.`,
    });

  if (input.pulados > 0)
    alertas.push({
      tipo: "NUMEROS_PULADOS",
      nivel: "info",
      mensagem: `${input.pulados} ${input.pulados === 1 ? "número pulado aguarda" : "números pulados aguardam"} inutilização na SEFAZ.`,
    });

  return alertas.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}
