import { Graph, layout } from "@dagrejs/dagre";

// Posição de cada cartão. As tabelas ligadas vão pelo dagre, da que aponta
// (esquerda) para a apontada (direita) — o traço sai do lado direito de uma e
// entra no esquerdo da outra, sem dar a volta. As soltas vão numa grade abaixo:
// no dagre elas virariam uma coluna de 30 cartões empilhados.

export const LARGURA_DO_NO = 288;
export const ALTURA_DO_CABECALHO = 44;
export const ALTURA_DA_LINHA = 26;
export const ALTURA_DO_RODAPE = 30;
/** Cartão expandido rola por dentro a partir daqui. */
export const ALTURA_MAXIMA_DO_CORPO = 416;

export function alturaDoNo(linhas: number, temRodape: boolean): number {
  const corpo = Math.min(linhas * ALTURA_DA_LINHA, ALTURA_MAXIMA_DO_CORPO);
  return ALTURA_DO_CABECALHO + corpo + (temRodape ? ALTURA_DO_RODAPE : 0) + 2;
}

export interface NoParaPosicionar {
  id: string;
  altura: number;
}

export interface Posicao {
  x: number;
  y: number;
}

const ESPACO = 48;
const ESPACO_VERTICAL = 32;
const ESPACO_ENTRE_FAIXAS = 140;
const PROPORCAO_DA_TELA = 16 / 9;

export function posicionar(
  nos: NoParaPosicionar[],
  arestas: { de: string; para: string }[],
): Map<string, Posicao> {
  const posicoes = new Map<string, Posicao>();
  const ligados = new Set(
    arestas.filter((a) => a.de !== a.para).flatMap((a) => [a.de, a.para]),
  );

  const grafo = new Graph();
  grafo.setGraph({
    rankdir: "LR",
    nodesep: ESPACO_VERTICAL,
    ranksep: ESPACO_ENTRE_FAIXAS,
  });
  grafo.setDefaultEdgeLabel(() => ({}));
  for (const no of nos) {
    if (ligados.has(no.id)) {
      grafo.setNode(no.id, { width: LARGURA_DO_NO, height: no.altura });
    }
  }
  for (const aresta of arestas) {
    if (
      aresta.de !== aresta.para &&
      grafo.hasNode(aresta.de) &&
      grafo.hasNode(aresta.para)
    ) {
      grafo.setEdge(aresta.de, aresta.para);
    }
  }
  layout(grafo);

  // O dagre põe na mesma faixa todas as tabelas do mesmo nível. Com 100
  // tabelas apontando para poucas "mestras" (o SWMS do Armazém), a faixa vira
  // uma coluna de 25 mil pixels. Aqui cada faixa alta é quebrada em várias
  // colunas lado a lado, mirando um desenho deitado como a tela (≈16:9), na
  // ordem vertical que o dagre escolheu para reduzir cruzamentos.
  const porFaixa = new Map<
    number,
    { id: string; altura: number; y: number }[]
  >();
  let somaDasAlturas = 0;
  for (const no of nos) {
    if (!ligados.has(no.id)) continue;
    const centro = grafo.node(no.id);
    const faixa = Math.round(centro.x);
    porFaixa.set(faixa, [
      ...(porFaixa.get(faixa) ?? []),
      { id: no.id, altura: no.altura, y: centro.y },
    ]);
    somaDasAlturas += no.altura + ESPACO_VERTICAL;
  }
  const alturaMaxima = Math.max(
    1200,
    Math.sqrt((somaDasAlturas * (LARGURA_DO_NO + ESPACO)) / PROPORCAO_DA_TELA),
  );

  let fundo = 0;
  let esquerda = 0;
  for (const faixa of [...porFaixa.keys()].sort((a, b) => a - b)) {
    const nosDaFaixa = (porFaixa.get(faixa) ?? []).sort((a, b) => a.y - b.y);
    let coluna = 0;
    let topo = 0;
    for (const no of nosDaFaixa) {
      if (topo > 0 && topo + no.altura > alturaMaxima) {
        coluna += 1;
        topo = 0;
      }
      posicoes.set(no.id, {
        x: esquerda + coluna * (LARGURA_DO_NO + ESPACO),
        y: topo,
      });
      topo += no.altura + ESPACO_VERTICAL;
      fundo = Math.max(fundo, topo);
    }
    esquerda += (coluna + 1) * (LARGURA_DO_NO + ESPACO) + ESPACO_ENTRE_FAIXAS;
  }

  const soltos = nos.filter((no) => !ligados.has(no.id));
  const porLinha = Math.max(4, Math.ceil(Math.sqrt(soltos.length)));
  let topo = ligados.size > 0 ? fundo + ESPACO * 2 : 0;
  for (let inicio = 0; inicio < soltos.length; inicio += porLinha) {
    const linha = soltos.slice(inicio, inicio + porLinha);
    linha.forEach((no, indice) => {
      posicoes.set(no.id, {
        x: indice * (LARGURA_DO_NO + ESPACO),
        y: topo,
      });
    });
    topo += Math.max(...linha.map((no) => no.altura)) + ESPACO;
  }

  return posicoes;
}
