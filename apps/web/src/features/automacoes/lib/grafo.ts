import type { CrmNodeType } from "@/generated/prisma/enums";

/**
 * O grafo de uma automação, sem banco e sem efeito.
 *
 * Fica separado do executor de propósito: decidir "qual é o próximo nó" é a
 * parte que erra em silêncio — grafo desconexo, ciclo, filtro sem saída — e é
 * a única parte que dá para testar sem WhatsApp, sem Inngest e sem relógio.
 */

export type No = {
  id: string;
  type: CrmNodeType;
  name: string;
  data: Record<string, unknown>;
};

export type Aresta = {
  fromNodeId: string;
  toNodeId: string;
  /** "main" nos nós comuns; "sim"/"nao" nas duas saídas do `FILTER`. */
  fromOutput: string;
};

export type Grafo = { nos: No[]; arestas: Aresta[] };

/** Teto de nós por execução. Grafo com ciclo para aqui em vez de rodar sempre. */
export const MAXIMO_DE_NOS = 50;

export function ehGatilho(tipo: CrmNodeType): boolean {
  return tipo.startsWith("TRIGGER_");
}

/**
 * O gatilho do workflow.
 *
 * Um só, sempre. Multi-gatilho existe no Órbita junto com o modo agente; aqui
 * dois gatilhos no mesmo grafo significaria duas execuções concorrentes sobre
 * o mesmo lead, e é mais barato pedir dois workflows.
 */
export function acharGatilho(grafo: Grafo): No | null {
  const gatilhos = grafo.nos.filter((no) => ehGatilho(no.type));
  return gatilhos.length === 1 ? gatilhos[0] : null;
}

/** Para onde ir depois de `noId`, saindo pela porta `saida`. */
export function proximos(grafo: Grafo, noId: string, saida = "main"): No[] {
  const porId = new Map(grafo.nos.map((no) => [no.id, no]));
  return grafo.arestas
    .filter(
      (aresta) => aresta.fromNodeId === noId && aresta.fromOutput === saida,
    )
    .map((aresta) => porId.get(aresta.toNodeId))
    .filter((no): no is No => Boolean(no));
}

export type ProblemaNoGrafo = {
  codigo:
    | "SEM_GATILHO"
    | "MAIS_DE_UM_GATILHO"
    | "GATILHO_SEM_SAIDA"
    | "NO_SOLTO"
    | "CICLO"
    | "ARESTA_QUEBRADA";
  mensagem: string;
  nodeId?: string;
};

/**
 * Diz o que impede o workflow de rodar — para a tela recusar a ativação em vez
 * de deixar o operador achar que ligou algo que nunca vai disparar.
 *
 * Ciclo é problema e não recurso: sem o modo agente não há "voltar ao começo"
 * legítimo, e um ciclo com `SEND_MESSAGE` dentro é mensagem repetida ao
 * cliente até o teto por hora cortar.
 */
export function validarGrafo(grafo: Grafo): ProblemaNoGrafo[] {
  const problemas: ProblemaNoGrafo[] = [];
  const porId = new Map(grafo.nos.map((no) => [no.id, no]));

  for (const aresta of grafo.arestas) {
    if (!porId.has(aresta.fromNodeId) || !porId.has(aresta.toNodeId)) {
      problemas.push({
        codigo: "ARESTA_QUEBRADA",
        mensagem: "Há uma ligação apontando para um passo que não existe mais.",
      });
    }
  }

  const gatilhos = grafo.nos.filter((no) => ehGatilho(no.type));
  if (gatilhos.length === 0) {
    return [
      ...problemas,
      {
        codigo: "SEM_GATILHO",
        mensagem: "A automação precisa de um gatilho — o que a faz começar.",
      },
    ];
  }
  if (gatilhos.length > 1) {
    return [
      ...problemas,
      {
        codigo: "MAIS_DE_UM_GATILHO",
        mensagem:
          "Só pode haver um gatilho. Para dois começos diferentes, use duas automações.",
      },
    ];
  }

  const gatilho = gatilhos[0];
  if (proximos(grafo, gatilho.id).length === 0) {
    problemas.push({
      codigo: "GATILHO_SEM_SAIDA",
      mensagem:
        "O gatilho não leva a nenhum passo — a automação não faria nada.",
      nodeId: gatilho.id,
    });
  }

  // Alcançáveis a partir do gatilho, por qualquer porta.
  const alcancados = new Set<string>([gatilho.id]);
  const fila = [gatilho.id];
  while (fila.length > 0) {
    const atual = fila.shift() as string;
    for (const aresta of grafo.arestas.filter((a) => a.fromNodeId === atual)) {
      if (alcancados.has(aresta.toNodeId)) continue;
      alcancados.add(aresta.toNodeId);
      fila.push(aresta.toNodeId);
    }
  }

  for (const no of grafo.nos) {
    if (!alcancados.has(no.id)) {
      problemas.push({
        codigo: "NO_SOLTO",
        mensagem: `"${no.name}" não está ligado ao gatilho e nunca vai rodar.`,
        nodeId: no.id,
      });
    }
  }

  if (temCiclo(grafo)) {
    problemas.push({
      codigo: "CICLO",
      mensagem:
        "As ligações formam um ciclo. A automação rodaria em loop até bater o limite por hora.",
    });
  }

  return problemas;
}

function temCiclo(grafo: Grafo): boolean {
  const EM_VISITA = 1;
  const PRONTO = 2;
  const estado = new Map<string, number>();

  const visitar = (noId: string): boolean => {
    const marca = estado.get(noId);
    if (marca === EM_VISITA) return true;
    if (marca === PRONTO) return false;

    estado.set(noId, EM_VISITA);
    for (const aresta of grafo.arestas.filter((a) => a.fromNodeId === noId)) {
      if (visitar(aresta.toNodeId)) return true;
    }
    estado.set(noId, PRONTO);
    return false;
  };

  return grafo.nos.some((no) => visitar(no.id));
}
