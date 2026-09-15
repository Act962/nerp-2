import { describe, expect, it } from "vitest";
import type { Jornada } from "../catalogo/tipos";
import { novaSessao } from "../lib/sessao";
import { type EstadoDaJornada, reduzir } from "./maquina";

const JORNADA: Jornada = {
  id: "teste",
  modulo: "produtos",
  titulo: "Teste",
  descricao: "Uma jornada de teste",
  rota: "/produtos",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "a",
      titulo: "Um",
      texto: "Leia",
      tempoMinimoMs: 2000,
    },
    { tipo: "clicar", alvo: "b", titulo: "Dois", texto: "Clique" },
    { tipo: "digitar", alvo: "c", titulo: "Três", texto: "Digite" },
    {
      tipo: "navegar",
      destino: "/produtos/novo",
      titulo: "Quatro",
      texto: "Vá",
    },
  ],
};

const SESSAO = novaSessao({
  jornadaId: "teste",
  organizationId: "org_1",
  iniciadaEm: "2026-09-12T10:00:00.000Z",
});

function mostrando(passo: number, agora = 1000): EstadoDaJornada {
  return {
    fase: "mostrando",
    sessao: { ...SESSAO, passo, passoMostradoEm: agora },
    falaDePressa: false,
  };
}

describe("PROXIMO", () => {
  it("antes do tempo mínimo não avança e conta o apresso", () => {
    const depois = reduzir(
      mostrando(0),
      { tipo: "PROXIMO", agora: 1500 },
      JORNADA,
    );
    expect(depois.fase).toBe("mostrando");
    if (depois.fase !== "mostrando") return;
    expect(depois.sessao.passo).toBe(0);
    expect(depois.sessao.apressos).toBe(1);
    expect(depois.falaDePressa).toBe(true);
  });

  it("a fala de pressa aparece uma vez por passo, mas o apresso segue contando", () => {
    const primeiro = reduzir(
      mostrando(0),
      { tipo: "PROXIMO", agora: 1500 },
      JORNADA,
    );
    const segundo = reduzir(
      primeiro,
      { tipo: "PROXIMO", agora: 1600 },
      JORNADA,
    );
    expect(segundo.fase).toBe("mostrando");
    if (segundo.fase !== "mostrando") return;
    expect(segundo.falaDePressa).toBe(false);
    expect(segundo.sessao.apressos).toBe(2);
  });

  it("cumprido o tempo, avança e guarda quanto durou", () => {
    const depois = reduzir(
      mostrando(0),
      { tipo: "PROXIMO", agora: 4000 },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(1);
    expect(depois.sessao.tempos).toEqual([3000]);
  });

  it("não pula passo de clique — ali a prova é o clique", () => {
    const depois = reduzir(
      mostrando(1),
      { tipo: "PROXIMO", agora: 99_000 },
      JORNADA,
    );
    expect(depois).toBe(mostrando(1) && depois);
    expect(depois.fase).toBe("mostrando");
    if (depois.fase !== "mostrando") return;
    expect(depois.sessao.passo).toBe(1);
  });
});

describe("CLIQUE_NO_ALVO", () => {
  it("avança quando é o alvo do passo, sem esperar tempo nenhum", () => {
    const depois = reduzir(
      mostrando(1),
      { tipo: "CLIQUE_NO_ALVO", chave: "b", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(2);
  });

  it("clique em outro lugar não conta", () => {
    const depois = reduzir(
      mostrando(1),
      { tipo: "CLIQUE_NO_ALVO", chave: "outro", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("mostrando");
    if (depois.fase !== "mostrando") return;
    expect(depois.sessao.passo).toBe(1);
  });

  it("clique não avança passo de leitura", () => {
    const depois = reduzir(
      mostrando(0),
      { tipo: "CLIQUE_NO_ALVO", chave: "a", agora: 9000 },
      JORNADA,
    );
    expect(depois.fase).toBe("mostrando");
  });
});

describe("DIGITOU", () => {
  it("campo vazio não avança", () => {
    const depois = reduzir(
      mostrando(2),
      { tipo: "DIGITOU", chave: "c", valor: "   ", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("mostrando");
  });

  it("com conteúdo, avança", () => {
    const depois = reduzir(
      mostrando(2),
      { tipo: "DIGITOU", chave: "c", valor: "arroz", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(3);
  });
});

describe("ROTA_MUDOU", () => {
  it("chegar ao destino fecha o passo de navegar — e era o último", () => {
    const depois = reduzir(
      mostrando(3),
      { tipo: "ROTA_MUDOU", pathname: "/produtos/novo", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("concluindo");
  });

  it("sair da tela do passo faz voltar a procurar o alvo", () => {
    const depois = reduzir(
      mostrando(1),
      { tipo: "ROTA_MUDOU", pathname: "/clientes", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(1);
  });

  it("continuar na mesma tela não mexe em nada", () => {
    const antes = mostrando(1);
    const depois = reduzir(
      antes,
      { tipo: "ROTA_MUDOU", pathname: "/produtos", agora: 1100 },
      JORNADA,
    );
    expect(depois).toBe(antes);
  });

  it("fora da tela do passo, o aviso de ausência NÃO vira laço", () => {
    const ausente: EstadoDaJornada = {
      fase: "alvoAusente",
      sessao: { ...SESSAO, passo: 1 },
      motivo: "foraDaRota",
    };
    // Mesmo objeto de volta: sem isto, a fase muda, o efeito de rota dispara
    // outra vez e o React derruba a página com "Maximum update depth".
    const depois = reduzir(
      ausente,
      { tipo: "ROTA_MUDOU", pathname: "/outra-tela", agora: 1100 },
      JORNADA,
    );
    expect(depois).toBe(ausente);
  });

  it("de volta à tela certa, o passo ausente volta a ser procurado", () => {
    const ausente: EstadoDaJornada = {
      fase: "alvoAusente",
      sessao: { ...SESSAO, passo: 1 },
      motivo: "foraDaRota",
    };
    const depois = reduzir(
      ausente,
      { tipo: "ROTA_MUDOU", pathname: "/produtos", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
  });
});

describe("ALVO_NAO_ENCONTRADO", () => {
  const COM_OPCIONAL: Jornada = {
    ...JORNADA,
    passos: [
      { tipo: "ler", alvo: "a", titulo: "Um", texto: "Leia", opcional: true },
      { tipo: "ler", alvo: "b", titulo: "Dois", texto: "Leia" },
    ],
  };

  it("passo opcional sem alvo é pulado em silêncio", () => {
    const depois = reduzir(
      { fase: "procurandoAlvo", sessao: { ...SESSAO, passo: 0 } },
      { tipo: "ALVO_NAO_ENCONTRADO", motivo: "timeout" },
      COM_OPCIONAL,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(1);
  });

  it("passo obrigatório sem alvo avisa em vez de sumir", () => {
    const depois = reduzir(
      { fase: "procurandoAlvo", sessao: { ...SESSAO, passo: 1 } },
      { tipo: "ALVO_NAO_ENCONTRADO", motivo: "timeout" },
      COM_OPCIONAL,
    );
    expect(depois.fase).toBe("alvoAusente");
  });

  it("último passo opcional ausente leva à conclusão", () => {
    const depois = reduzir(
      { fase: "procurandoAlvo", sessao: { ...SESSAO, passo: 1 } },
      { tipo: "ALVO_NAO_ENCONTRADO", motivo: "timeout" },
      {
        ...JORNADA,
        passos: [
          { tipo: "ler", alvo: "a", titulo: "Um", texto: "Leia" },
          {
            tipo: "ler",
            alvo: "b",
            titulo: "Dois",
            texto: "Leia",
            opcional: true,
          },
        ],
      },
    );
    expect(depois.fase).toBe("concluindo");
  });
});

describe("fecho", () => {
  it("FECHAR encerra de qualquer fase", () => {
    expect(reduzir(mostrando(2), { tipo: "FECHAR" }, JORNADA).fase).toBe(
      "ociosa",
    );
    expect(
      reduzir(
        { fase: "concluindo", sessao: SESSAO },
        { tipo: "FECHAR" },
        JORNADA,
      ).fase,
    ).toBe("ociosa");
  });

  it("CONCLUIDA guarda o que aconteceu com as ★", () => {
    const depois = reduzir(
      { fase: "concluindo", sessao: SESSAO },
      {
        tipo: "CONCLUIDA",
        starsCreditadas: 10,
        resgatadaPor: null,
        motivo: "creditada",
      },
      JORNADA,
    );
    expect(depois.fase).toBe("concluida");
    if (depois.fase !== "concluida") return;
    expect(depois.starsCreditadas).toBe(10);
  });

  it("falhar ao concluir devolve ao último passo, sem perder o feito", () => {
    const depois = reduzir(
      { fase: "concluindo", sessao: { ...SESSAO, passo: 4 } },
      { tipo: "FALHOU_CONCLUIR" },
      JORNADA,
    );
    expect(depois.fase).toBe("procurandoAlvo");
    if (depois.fase !== "procurandoAlvo") return;
    expect(depois.sessao.passo).toBe(3);
  });

  it("o último passo leva à conclusão", () => {
    const depois = reduzir(
      mostrando(3),
      { tipo: "ROTA_MUDOU", pathname: "/produtos/novo", agora: 1100 },
      JORNADA,
    );
    expect(depois.fase).toBe("concluindo");
    if (depois.fase !== "concluindo") return;
    expect(depois.sessao.passo).toBe(4);
  });
});
