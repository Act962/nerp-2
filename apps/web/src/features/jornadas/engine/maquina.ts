import type { Jornada } from "../catalogo/tipos";
import { casaRota } from "../lib/rota";
import type { JornadaEmAndamento } from "../lib/sessao";
import { tempoMinimoDoPasso } from "../lib/tempo";

/**
 * O motor da jornada, sem React e sem DOM.
 *
 * Tudo o que decide se um passo avança mora aqui, em função pura, porque é a
 * parte que precisa de teste: o resto (achar o elemento, desenhar o balão,
 * ouvir o clique) é encanamento do navegador.
 */

export type MotivoDeAusencia = "timeout" | "foraDaRota";

export type EstadoDaJornada =
  | { fase: "ociosa" }
  | { fase: "procurandoAlvo"; sessao: JornadaEmAndamento }
  | {
      fase: "mostrando";
      sessao: JornadaEmAndamento;
      /** A fala "sei que tá com pressa" está na tela agora. */
      falaDePressa: boolean;
    }
  | {
      fase: "alvoAusente";
      sessao: JornadaEmAndamento;
      motivo: MotivoDeAusencia;
    }
  | { fase: "concluindo"; sessao: JornadaEmAndamento }
  | {
      fase: "concluida";
      jornadaId: string;
      starsCreditadas: number;
      resgatadaPor: string | null;
      motivo: string;
    };

export type EventoDaJornada =
  | { tipo: "INICIAR"; sessao: JornadaEmAndamento }
  | { tipo: "RETOMAR"; sessao: JornadaEmAndamento }
  | { tipo: "ALVO_ENCONTRADO"; agora: number }
  | { tipo: "ALVO_NAO_ENCONTRADO"; motivo: MotivoDeAusencia }
  | { tipo: "PROXIMO"; agora: number }
  | { tipo: "CLIQUE_NO_ALVO"; chave: string; agora: number }
  | { tipo: "DIGITOU"; chave: string; valor: string; agora: number }
  | { tipo: "ROTA_MUDOU"; pathname: string; agora: number }
  | { tipo: "FECHAR" }
  | {
      tipo: "CONCLUIDA";
      starsCreditadas: number;
      resgatadaPor: string | null;
      motivo: string;
    }
  | { tipo: "FALHOU_CONCLUIR" };

/** O passo em que a sessão está, ou `null` quando ela já passou do fim. */
export function passoAtual(jornada: Jornada, sessao: JornadaEmAndamento) {
  return jornada.passos[sessao.passo] ?? null;
}

/** Onde o passo acontece — o dele, ou o da jornada. */
export function rotaDoPasso(
  jornada: Jornada,
  indice: number,
): string | undefined {
  const passo = jornada.passos[indice];
  if (!passo) return undefined;
  if (passo.tipo === "navegar") return passo.destino;
  return passo.rota ?? jornada.rota;
}

/**
 * Fecha o passo atual e vai para o próximo — ou para a conclusão, quando era o
 * último. O tempo gasto entra em `tempos` para o admin enxergar depois onde a
 * explicação está longa demais.
 */
function avancar(
  estado: Extract<EstadoDaJornada, { fase: "mostrando" }>,
  jornada: Jornada,
  agora: number,
): EstadoDaJornada {
  const { sessao } = estado;
  const gasto = sessao.passoMostradoEm ? agora - sessao.passoMostradoEm : 0;
  const proximo: JornadaEmAndamento = {
    ...sessao,
    passo: sessao.passo + 1,
    passoMostradoEm: null,
    tempos: [...sessao.tempos, gasto],
    avisouPressaNoPasso: null,
  };
  if (proximo.passo >= jornada.passos.length) {
    return { fase: "concluindo", sessao: proximo };
  }
  return { fase: "procurandoAlvo", sessao: proximo };
}

export function reduzir(
  estado: EstadoDaJornada,
  evento: EventoDaJornada,
  jornada: Jornada | null,
): EstadoDaJornada {
  // "Fechar instrução" vale em qualquer fase, e é o que garante que ninguém
  // fica preso num balão que não encontra o alvo.
  if (evento.tipo === "FECHAR") return { fase: "ociosa" };

  if (evento.tipo === "INICIAR" || evento.tipo === "RETOMAR") {
    return { fase: "procurandoAlvo", sessao: evento.sessao };
  }

  if (!jornada || estado.fase === "ociosa" || estado.fase === "concluida") {
    return estado;
  }

  switch (estado.fase) {
    case "procurandoAlvo": {
      if (evento.tipo === "ALVO_ENCONTRADO") {
        return {
          fase: "mostrando",
          sessao: { ...estado.sessao, passoMostradoEm: evento.agora },
          falaDePressa: false,
        };
      }
      if (evento.tipo === "ALVO_NAO_ENCONTRADO") {
        // Passo opcional sem alvo na tela: segue adiante sem dizer nada. É o
        // que impede a jornada de travar num atalho que a pessoa não escolheu
        // ou num botão que só o administrador enxerga.
        const passo = passoAtual(jornada, estado.sessao);
        if (passo?.opcional) {
          const adiante = {
            ...estado.sessao,
            passo: estado.sessao.passo + 1,
            passoMostradoEm: null,
            tempos: [...estado.sessao.tempos, 0],
            avisouPressaNoPasso: null,
          };
          return adiante.passo >= jornada.passos.length
            ? { fase: "concluindo", sessao: adiante }
            : { fase: "procurandoAlvo", sessao: adiante };
        }
        return {
          fase: "alvoAusente",
          sessao: estado.sessao,
          motivo: evento.motivo,
        };
      }
      return estado;
    }

    case "alvoAusente": {
      /*
        Voltar para a tela certa devolve a jornada ao ponto em que ela parou —
        mas SÓ se a tela for mesmo a do passo.

        Sem essa conferência, um passo que aponta para a rota errada entra em
        laço: procura o alvo, não acha, avisa; o aviso muda a fase, o efeito de
        rota dispara de novo, e volta a procurar. O React derruba a página com
        "Maximum update depth exceeded" — e o estrago aparece na tela de quem
        está aprendendo, por causa de uma linha errada no catálogo.
      */
      if (
        evento.tipo === "ROTA_MUDOU" &&
        casaRota(rotaDoPasso(jornada, estado.sessao.passo), evento.pathname)
      ) {
        return { fase: "procurandoAlvo", sessao: estado.sessao };
      }
      return estado;
    }

    case "mostrando": {
      const passo = passoAtual(jornada, estado.sessao);
      if (!passo) return { fase: "concluindo", sessao: estado.sessao };

      switch (evento.tipo) {
        case "PROXIMO": {
          // "Próximo" não pula passo de clique: ali a prova de que a pessoa fez
          // é o clique, e um botão que adianta tornaria o resto decorativo.
          if (passo.tipo !== "ler") return estado;

          const mostradoEm = estado.sessao.passoMostradoEm ?? evento.agora;
          const faltando =
            tempoMinimoDoPasso(passo) - (evento.agora - mostradoEm);
          if (faltando > 0) {
            const jaAvisou =
              estado.sessao.avisouPressaNoPasso === estado.sessao.passo;
            return {
              fase: "mostrando",
              sessao: {
                ...estado.sessao,
                apressos: estado.sessao.apressos + 1,
                avisouPressaNoPasso: estado.sessao.passo,
              },
              // A fala aparece UMA vez por passo. Repetida a cada clique ela
              // vira ruído, e ruído a pessoa aprende a ignorar.
              falaDePressa: !jaAvisou,
            };
          }
          return avancar(estado, jornada, evento.agora);
        }

        case "CLIQUE_NO_ALVO": {
          if (passo.tipo !== "clicar" || evento.chave !== passo.alvo) {
            return estado;
          }
          // Sem tempo mínimo aqui: clicar no lugar certo já é a prova de que a
          // pessoa leu o suficiente para saber onde clicar.
          return avancar(estado, jornada, evento.agora);
        }

        case "DIGITOU": {
          if (passo.tipo !== "digitar" || evento.chave !== passo.alvo) {
            return estado;
          }
          if (evento.valor.trim().length === 0) return estado;
          return avancar(estado, jornada, evento.agora);
        }

        case "ROTA_MUDOU": {
          if (
            passo.tipo === "navegar" &&
            casaRota(passo.destino, evento.pathname)
          ) {
            return avancar(estado, jornada, evento.agora);
          }
          // Saiu da tela do passo: o alvo não existe mais, então volta a
          // procurar em vez de continuar apontando para um retângulo velho.
          if (
            !casaRota(
              rotaDoPasso(jornada, estado.sessao.passo),
              evento.pathname,
            )
          ) {
            return { fase: "procurandoAlvo", sessao: estado.sessao };
          }
          return estado;
        }

        default:
          return estado;
      }
    }

    case "concluindo": {
      if (evento.tipo === "CONCLUIDA") {
        return {
          fase: "concluida",
          jornadaId: estado.sessao.jornadaId,
          starsCreditadas: evento.starsCreditadas,
          resgatadaPor: evento.resgatadaPor,
          motivo: evento.motivo,
        };
      }
      if (evento.tipo === "FALHOU_CONCLUIR") {
        // Volta ao último passo: a pessoa fez a jornada, o que falhou foi a
        // conclusão. Perder o progresso puniria quem não errou nada.
        const voltou = Math.max(0, estado.sessao.passo - 1);
        return {
          fase: "procurandoAlvo",
          sessao: { ...estado.sessao, passo: voltou, passoMostradoEm: null },
        };
      }
      return estado;
    }

    default:
      return estado;
  }
}
