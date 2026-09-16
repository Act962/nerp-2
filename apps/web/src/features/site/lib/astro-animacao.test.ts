import { describe, expect, it } from "vitest";
import {
  type AstroCamada,
  CAMADA_PADRAO,
  cenaNova,
  duracaoReal,
  escalaComEspelho,
  estadoNoTempo,
  ESTADO_ZERO,
  lerAnimacao,
  lerAnimacoesPorMomento,
  MOVIMENTOS,
  podeSeguir,
  quadro,
  sincronizarVinculos,
  slugificarAnimacao,
} from "@nerp/site-content";

function camada(troca: Partial<AstroCamada> = {}): AstroCamada {
  return {
    id: "mao",
    nome: "Mão",
    tipo: "imagem",
    src: "/astro/camadas/maos/mao_01.webp",
    texto: "",
    cor: "#011121",
    largura: 240,
    altura: 240,
    ...CAMADA_PADRAO,
    ini: { ...ESTADO_ZERO, x: 0 },
    fim: { ...ESTADO_ZERO, x: 100 },
    ...troca,
  };
}

describe("estadoNoTempo", () => {
  it("fica no início enquanto o atraso não passou", () => {
    const c = camada({ atraso: 0.5, duracao: 1, repete: 0, easing: "none" });
    expect(estadoNoTempo(c, 0.4).x).toBe(0);
    expect(estadoNoTempo(c, 0.5).x).toBe(0);
  });

  it("interpola linearmente com easing none", () => {
    const c = camada({ duracao: 1, repete: 0, vaivem: false, easing: "none" });
    expect(estadoNoTempo(c, 0.25).x).toBeCloseTo(25);
    expect(estadoNoTempo(c, 0.5).x).toBeCloseTo(50);
  });

  it("volta no segundo ciclo quando vai e volta", () => {
    const c = camada({ duracao: 1, repete: -1, vaivem: true, easing: "none" });
    expect(estadoNoTempo(c, 0.25).x).toBeCloseTo(25);
    expect(estadoNoTempo(c, 1.25).x).toBeCloseTo(75);
  });

  /**
   * A regra que justifica o ramo de "congelar": uma entrada que vai e volta um
   * número PAR de vezes termina onde começou. Sem isso o mascote encerraria a
   * cena saltando de volta para fora da tela.
   */
  it("congela no início depois de um número par de ciclos de vaivém", () => {
    const c = camada({ duracao: 1, repete: 1, vaivem: true, easing: "none" });
    expect(estadoNoTempo(c, 99).x).toBe(0);
  });

  it("congela no fim depois de um número ímpar de ciclos", () => {
    const c = camada({ duracao: 1, repete: 0, vaivem: true, easing: "none" });
    expect(estadoNoTempo(c, 99).x).toBe(100);
  });

  it("não divide por zero quando a duração é zero", () => {
    const c = camada({ duracao: 0 });
    expect(estadoNoTempo(c, 5)).toEqual(c.ini);
  });
});

describe("quadro", () => {
  const cena = (camadas: AstroCamada[]) => ({
    ...cenaNova("Teste"),
    duracao: 2,
    camadas,
  });

  /**
   * A razão de o relógio não zerar no laço: o ciclo de quem repete para sempre
   * não tem relação com o ponto em que a cena reinicia. Cortar ali é o que
   * fazia a peça saltar assim que as durações deixavam de ser todas iguais.
   */
  it("quem repete para sempre atravessa o laço da cena sem saltar", () => {
    const c = camada({
      id: "bola",
      duracao: 3,
      repete: -1,
      vaivem: false,
      easing: "none",
      ini: { ...ESTADO_ZERO, x: 0 },
      fim: { ...ESTADO_ZERO, x: 300 },
    });
    // A cena dá a volta em 3s (piso de `duracao`), a camada em 3s: em t=4 ela
    // tem de estar em 1s do próprio ciclo, e não recomeçada.
    expect(quadro(cena([c]), 4).bola.x).toBeCloseTo(100);
    expect(quadro(cena([c]), 7).bola.x).toBeCloseTo(100);
  });

  it("quem tem repetições contadas recomeça a cada volta da cena", () => {
    const c = camada({
      id: "mao",
      duracao: 1,
      repete: 0,
      vaivem: false,
      easing: "none",
      ini: { ...ESTADO_ZERO, x: 0 },
      fim: { ...ESTADO_ZERO, x: 100 },
    });
    // Termina em 1s e congela; a volta da cena (2s) a traz de volta ao meio.
    expect(quadro(cena([c]), 1.5).mao.x).toBe(100);
    expect(quadro(cena([c]), 2.5).mao.x).toBeCloseTo(50);
  });

  it("cena que não repete congela no fim em vez de dar a volta", () => {
    const c = camada({
      id: "mao",
      duracao: 1,
      repete: 0,
      vaivem: false,
      easing: "none",
      ini: { ...ESTADO_ZERO, x: 0 },
      fim: { ...ESTADO_ZERO, x: 100 },
    });
    const parada = { ...cena([c]), repete: false };
    expect(quadro(parada, 9).mao.x).toBe(100);
  });
});

describe("intervalo", () => {
  const piscar = camada({
    duracao: 0.1,
    intervalo: 2,
    repete: -1,
    vaivem: true,
    easing: "none",
    ini: { ...ESTADO_ZERO, op: 1 },
    fim: { ...ESTADO_ZERO, op: 0 },
  });

  it("anima no bloco e descansa no intervalo", () => {
    // bloco = ida e volta = 0,2s; depois 2s parada no início
    expect(estadoNoTempo(piscar, 0.05).op).toBeCloseTo(0.5);
    expect(estadoNoTempo(piscar, 0.1).op).toBeCloseTo(0);
    expect(estadoNoTempo(piscar, 0.15).op).toBeCloseTo(0.5);
    // descansando: de volta ao início e assim fica
    expect(estadoNoTempo(piscar, 0.5).op).toBe(1);
    expect(estadoNoTempo(piscar, 2.1).op).toBe(1);
    // a rodada seguinte começa em 2,2s
    expect(estadoNoTempo(piscar, 2.25).op).toBeCloseTo(0.5);
  });

  /**
   * A garantia que permitiu mexer no motor sem reescrever a conta dos ciclos:
   * sem intervalo, a fórmula do descanso é a identidade.
   */
  it("intervalo zero devolve o comportamento de antes", () => {
    const semDescanso = camada({
      duracao: 1,
      intervalo: 0,
      repete: -1,
      vaivem: true,
      easing: "none",
      ini: { ...ESTADO_ZERO, x: 0 },
      fim: { ...ESTADO_ZERO, x: 100 },
    });
    expect(estadoNoTempo(semDescanso, 0.25).x).toBeCloseTo(25);
    expect(estadoNoTempo(semDescanso, 1.25).x).toBeCloseTo(75);
  });
});

describe("duracaoReal", () => {
  it("estica até a camada que termina mais tarde", () => {
    const cena = {
      ...cenaNova("Aceno"),
      duracao: 1,
      camadas: [camada({ atraso: 2, duracao: 1.5, repete: 0 })],
    };
    expect(duracaoReal(cena)).toBeCloseTo(3.5);
  });

  it("ignora quem repete para sempre — quem manda é a cena", () => {
    const cena = {
      ...cenaNova("Pulsar"),
      duracao: 2,
      camadas: [camada({ atraso: 0, duracao: 9, repete: -1 })],
    };
    expect(duracaoReal(cena)).toBe(2);
  });
});

describe("escalaComEspelho", () => {
  const estado = { ...ESTADO_ZERO, esc: 1.5 };

  it("sem espelho, os dois eixos seguem a escala", () => {
    expect(escalaComEspelho(camada(), estado)).toEqual({ x: 1.5, y: 1.5 });
  });

  it("espelha só o eixo pedido", () => {
    expect(escalaComEspelho(camada({ espelhoX: true }), estado)).toEqual({
      x: -1.5,
      y: 1.5,
    });
    expect(escalaComEspelho(camada({ espelhoY: true }), estado)).toEqual({
      x: 1.5,
      y: -1.5,
    });
  });
});

describe("MOVIMENTOS", () => {
  const alvo = camada({
    ini: { ...ESTADO_ZERO, x: 300, y: 400 },
    fim: { ...ESTADO_ZERO, x: 999, y: 999 },
  });

  /**
   * A regra que sustenta os presets: a posição de INÍCIO é de quem arrasta no
   * palco. Um preset que a mexesse moveria a peça de lugar quando só se pediu
   * um movimento.
   */
  it("nenhum preset escreve em ini", () => {
    for (const m of MOVIMENTOS) {
      expect(m.aplicar(alvo)).not.toHaveProperty("ini");
    }
  });

  /**
   * `fim` nasce de `ini`, não do zero: a camada anda A PARTIR de onde está. Um
   * preset que ignorasse isso arrastaria a peça para o canto da cena.
   */
  it("todo preset parte do início da camada", () => {
    const movemX = new Set(["puxar", "pingue-pongue", "tremer"]);
    const movemY = new Set(["flutuar"]);
    for (const m of MOVIMENTOS) {
      const { fim } = m.aplicar(alvo) as { fim: typeof alvo.fim };
      if (!movemX.has(m.id)) expect(fim.x, m.id).toBe(300);
      if (!movemY.has(m.id)) expect(fim.y, m.id).toBe(400);
    }
  });

  it("parado devolve a camada ao repouso", () => {
    const parado = MOVIMENTOS.find((m) => m.id === "parado");
    expect(parado?.aplicar(alvo).fim).toEqual(alvo.ini);
  });

  it("girar dá uma volta inteira e não volta pelo caminho", () => {
    const girar = MOVIMENTOS.find((m) => m.id === "girar");
    const troca = girar?.aplicar(alvo);
    expect(troca?.fim?.rot).toBe(360);
    expect(troca?.vaivem).toBe(false);
  });
});

describe("sincronizarVinculos", () => {
  const lider = camada({
    id: "lider",
    ini: { ...ESTADO_ZERO, x: 100, y: 100 },
    fim: { ...ESTADO_ZERO, x: 160, y: 70 },
    duracao: 0.8,
    easing: "bounce.out",
    repete: 3,
    vaivem: false,
  });
  const seguidor = camada({
    id: "seguidor",
    vinculo: "lider",
    ini: { ...ESTADO_ZERO, x: 500, y: 500 },
    fim: { ...ESTADO_ZERO, x: 500, y: 500 },
  });

  /**
   * A regra que define o vínculo: copia-se o DESLOCAMENTO, não o destino.
   * Copiar o `fim` bruto jogaria o seguidor para cima do líder.
   */
  it("o seguidor faz o mesmo gesto a partir do próprio lugar", () => {
    const [, s] = sincronizarVinculos([lider, seguidor]);
    expect(s.ini).toEqual(seguidor.ini);
    expect(s.fim.x).toBe(560);
    expect(s.fim.y).toBe(470);
  });

  it("os tempos vêm do líder", () => {
    const [, s] = sincronizarVinculos([lider, seguidor]);
    expect(s.duracao).toBe(0.8);
    expect(s.easing).toBe("bounce.out");
    expect(s.repete).toBe(3);
    expect(s.vaivem).toBe(false);
  });

  it("a opacidade não passa do teto do formato", () => {
    const some = camada({
      id: "lider",
      ini: { ...ESTADO_ZERO, op: 0 },
      fim: { ...ESTADO_ZERO, op: 1 },
    });
    const [, s] = sincronizarVinculos([
      some,
      camada({ id: "s", vinculo: "lider", ini: ESTADO_ZERO, fim: ESTADO_ZERO }),
    ]);
    expect(s.fim.op).toBe(1);
  });

  /** Líder apagado não pode deixar um ponteiro solto para trás. */
  it("vínculo órfão se desfaz", () => {
    const [s] = sincronizarVinculos([seguidor]);
    expect(s.vinculo).toBeNull();
  });

  it("corrente fechada não trava nem propaga", () => {
    const a = camada({ id: "a", vinculo: "b" });
    const b = camada({ id: "b", vinculo: "a" });
    const saida = sincronizarVinculos([a, b]);
    expect(saida.every((c) => c.vinculo === null)).toBe(true);
  });

  it("seguir quem já me segue é recusado", () => {
    const cena = [lider, seguidor];
    expect(podeSeguir(cena, "lider", "seguidor")).toBe(false);
    expect(podeSeguir(cena, "lider", "lider")).toBe(false);
    expect(podeSeguir(cena, "outro", "lider")).toBe(true);
  });
});

describe("slugificarAnimacao", () => {
  it("tira acento e espaço", () => {
    expect(slugificarAnimacao("Aceno de Boas-Vindas")).toBe(
      "aceno-de-boas-vindas",
    );
    expect(slugificarAnimacao("Coração  partido!")).toBe("coracao-partido");
  });
});

describe("fronteiras", () => {
  it("completa o que falta com os padrões", () => {
    const lida = lerAnimacao({
      slug: "aceno",
      nome: "Aceno",
      camadas: [{ id: "globo", tipo: "imagem", src: "/a.webp" }],
    });
    expect(lida?.versao).toBe(1);
    expect(lida?.camadas[0].easing).toBe("power2.inOut");
    // Campo novo entra com padrão: cena gravada antes do espelho continua
    // válida em vez de virar `null` e sumir da tela.
    expect(lida?.camadas[0].espelhoX).toBe(false);
    expect(lida?.camadas[0].ini).toEqual(ESTADO_ZERO);
  });

  it("recusa cena torta em vez de deixar passar pela metade", () => {
    expect(lerAnimacao({ camadas: [{ tipo: "bicicleta" }] })).toBeNull();
    expect(lerAnimacao(null)).toBeNull();
  });

  it("mapa de momentos inválido vira mapa vazio, não exceção", () => {
    expect(lerAnimacoesPorMomento("não é json disso")).toEqual({});
    expect(
      lerAnimacoesPorMomento({ momentos: { "404": cenaNova("Perdido") } }),
    ).toHaveProperty("404.nome", "Perdido");
  });
});
