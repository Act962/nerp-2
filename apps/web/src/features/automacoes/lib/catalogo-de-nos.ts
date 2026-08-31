import type { CrmNodeType } from "@/generated/prisma/enums";

/**
 * Como cada gatilho e cada passo se chamam na tela.
 *
 * Fica fora dos componentes porque a lista aparece em três lugares (escolher
 * gatilho, escolher passo, ler o histórico de execuções) e nome divergente
 * entre eles é o operador achando que são coisas diferentes.
 */

export const GATILHOS: {
  tipo: Extract<CrmNodeType, `TRIGGER_${string}`>;
  rotulo: string;
  descricao: string;
}[] = [
  {
    tipo: "TRIGGER_MESSAGE_IN",
    rotulo: "Quando chegar uma mensagem",
    descricao: "Toda vez que o cliente escrever no WhatsApp.",
  },
  {
    tipo: "TRIGGER_NEW_LEAD",
    rotulo: "Quando aparecer um contato novo",
    descricao: "Primeira mensagem de um número que ainda não estava no funil.",
  },
  {
    tipo: "TRIGGER_STAGE_CHANGED",
    rotulo: "Quando mudar de etapa",
    descricao: "O card foi arrastado para outra coluna do funil.",
  },
  {
    tipo: "TRIGGER_LEAD_IDLE",
    rotulo: "Quando ficar sem resposta",
    descricao: "O cliente não escreve há um tempo que você define.",
  },
  {
    tipo: "TRIGGER_MANUAL",
    rotulo: "Só quando eu mandar",
    descricao: "Não dispara sozinho.",
  },
];

export const PASSOS: {
  tipo: Exclude<CrmNodeType, `TRIGGER_${string}`>;
  rotulo: string;
  descricao: string;
}[] = [
  {
    tipo: "SEND_MESSAGE",
    rotulo: "Enviar mensagem",
    descricao:
      "Manda um texto pelo WhatsApp, se a janela de 24h estiver aberta.",
  },
  {
    tipo: "WAIT",
    rotulo: "Esperar",
    descricao: "Segura a automação por um tempo antes do passo seguinte.",
  },
  {
    tipo: "FILTER",
    rotulo: "Só continuar se…",
    descricao: "A automação para aqui quando a condição não bate.",
  },
  {
    tipo: "MOVE_STAGE",
    rotulo: "Mover de etapa",
    descricao: "Leva o card para outra coluna do funil.",
  },
  {
    tipo: "SET_TEMPERATURE",
    rotulo: "Mudar a temperatura",
    descricao: "Marca o contato como frio, morno, quente ou muito quente.",
  },
  {
    tipo: "SET_RESPONSIBLE",
    rotulo: "Definir responsável",
    descricao: "Entrega o atendimento para alguém da equipe.",
  },
  {
    tipo: "SET_WIN_LOSS",
    rotulo: "Marcar ganho ou perda",
    descricao: "Encerra o contato no funil.",
  },
  {
    tipo: "HTTP_REQUEST",
    rotulo: "Chamar um endereço (webhook)",
    descricao: "Avisa outro sistema. Endereços de rede interna são recusados.",
  },
];

const ROTULOS = new Map<string, string>([
  ...GATILHOS.map((g) => [g.tipo, g.rotulo] as const),
  ...PASSOS.map((p) => [p.tipo, p.rotulo] as const),
]);

export function rotuloDoNo(tipo: string): string {
  return ROTULOS.get(tipo) ?? tipo;
}

export const TEMPERATURAS = [
  { valor: "COLD", rotulo: "Frio" },
  { valor: "WARM", rotulo: "Morno" },
  { valor: "HOT", rotulo: "Quente" },
  { valor: "VERY_HOT", rotulo: "Muito quente" },
];

export const CAMPOS_DO_FILTRO = [
  { valor: "texto_da_mensagem", rotulo: "Texto da mensagem" },
  { valor: "temperatura", rotulo: "Temperatura" },
  { valor: "etapa", rotulo: "Etapa" },
  { valor: "responsavel", rotulo: "Responsável" },
  { valor: "cliente", rotulo: "Cliente do cadastro" },
  { valor: "valor", rotulo: "Valor do negócio" },
];

export const OPERADORES_DO_FILTRO = [
  { valor: "contem", rotulo: "contém" },
  { valor: "igual", rotulo: "é igual a" },
  { valor: "diferente", rotulo: "é diferente de" },
  { valor: "existe", rotulo: "está preenchido" },
  { valor: "nao_existe", rotulo: "está vazio" },
  { valor: "maior_que", rotulo: "é maior que" },
  { valor: "menor_que", rotulo: "é menor que" },
];
