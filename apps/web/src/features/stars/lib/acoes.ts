import { ACOES } from "./acoes-chaves";

/**
 * Catálogo das ações que podem custar ★, com o texto que a tela mostra.
 *
 * A descrição é texto de produto, não regra de negócio — por isso mora aqui e
 * não junto do motor de cobrança.
 */
export const ACOES_COBRAVEIS: {
  actionKey: string;
  label: string;
  descricao: string;
}[] = [
  {
    actionKey: ACOES.mensagemEnviada,
    label: "Mensagem enviada",
    descricao:
      "Cada texto ou arquivo que o atendente manda pelo chat, e cada mensagem que uma automação envia.",
  },
  {
    actionKey: ACOES.destinatarioDeCampanha,
    label: "Destinatário de campanha",
    descricao:
      "Cobrado por pessoa que recebe o disparo, depois do envio confirmado.",
  },
];
