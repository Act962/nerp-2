import { type Nivel, NIVEIS } from "./modelos";

/**
 * Que modelo esta mensagem merece.
 *
 * Modelo caro em pergunta fácil é dinheiro no lixo; modelo barato em pedido
 * difícil é resposta errada, que custa mais caro ainda. A escolha é por
 * heurística de texto — nenhuma chamada a modelo para decidir qual modelo
 * chamar, que seria pagar duas vezes pela mesma mensagem.
 *
 * **O padrão é o médio, e não o leve.** O erro de mandar para baixo aparece
 * como o Astro escolhendo a ferramenta errada ou inventando um número; o de
 * mandar para cima aparece como centavos. Na dúvida, paga-se os centavos.
 *
 * Módulo puro, e o teste é a rede: um roteador de texto sem teste vira, em
 * dois meses, um `if` que ninguém sabe explicar.
 */

/** Pede uma AÇÃO: tool de escrita, aprovação, consequência no mundo. */
const PEDE_ACAO =
  /\b(cri[ae]r?|crie|monta?r?|monte|gera?r?|gere|dispar[ae]r?|envi[ae]r?|mand[ae]r?|agend[ae]r?|marc[ae]r?|adicion[ae]r?|public[ae]r?|apag[ae]r?|remov[ae]r?|troc[ae]r?|atualiz[ae]r?)\b/;

/** Pede RACIOCÍNIO: comparar, explicar causa, projetar, recomendar. */
const PEDE_RACIOCINIO =
  /\b(por ?que|porque|analis[ae]r?|compar[ae]r?|explic[ae]r?|previs[ãa]o|prever|proje[çc][ãa]o|projet[ae]r?|recomend[ae]r?|sugir[ae]|sugest[ãa]o|estrat[ée]gia|melhor[ae]r?|otimiz[ae]r?|vale a pena|deveria|o que fazer|como fa[çz]o|diagn[óo]stico|tend[êe]ncia|risco|amea[çc]a)\b/;

/** Pergunta curta e fechada: contagem, saldo, data, sim ou não. */
const PERGUNTA_SIMPLES =
  /^(quant[oa]s?|qual|quais|quando|onde|quem|tem|há|existe)\b/;

export type Contexto = {
  /** O que a pessoa acabou de escrever. */
  texto: string;
  /** Há imagem anexada? Visão exige modelo capaz. */
  temAnexo: boolean;
  /** Há pedido de aprovação pendente ou respondido no histórico? */
  temAcaoNoHistorico: boolean;
  /** Quantas mensagens a conversa já tem. */
  mensagens: number;
};

export type Escolha = {
  nivel: Nivel;
  /** Por que este nível. Vai para o log, e o teste cobra o motivo. */
  motivo:
    | "anexo"
    | "acao"
    | "raciocinio"
    | "conversa-longa"
    | "pergunta-simples"
    | "padrao";
};

/** Quantas mensagens tornam a conversa "longa" o bastante para pesar. */
const CONVERSA_LONGA = 12;

export function escolherNivel(contexto: Contexto): Escolha {
  const texto = contexto.texto.trim().toLowerCase();

  // Imagem é visão, e visão em modelo fraco lê rótulo errado — e rótulo
  // errado vira preço errado no catálogo.
  if (contexto.temAnexo) return { nivel: "pesado", motivo: "anexo" };

  // Ação tem consequência no mundo: catálogo criado, campanha disparada. O
  // modelo precisa acertar a ferramenta E os argumentos.
  if (contexto.temAcaoNoHistorico || PEDE_ACAO.test(texto)) {
    return { nivel: "pesado", motivo: "acao" };
  }

  if (PEDE_RACIOCINIO.test(texto)) {
    return { nivel: "pesado", motivo: "raciocinio" };
  }

  // Conversa longa carrega histórico e costuma ter encadeado várias tools; o
  // barato começa a perder o fio.
  if (contexto.mensagens >= CONVERSA_LONGA) {
    return { nivel: "medio", motivo: "conversa-longa" };
  }

  // Pergunta curta e fechada que sobrou do atalho determinístico: uma tool de
  // leitura e uma frase. É o que o leve faz bem.
  if (PERGUNTA_SIMPLES.test(texto) && texto.length <= 80) {
    return { nivel: "leve", motivo: "pergunta-simples" };
  }

  return { nivel: "medio", motivo: "padrao" };
}

export function ehNivel(valor: string): valor is Nivel {
  return (NIVEIS as readonly string[]).includes(valor);
}
