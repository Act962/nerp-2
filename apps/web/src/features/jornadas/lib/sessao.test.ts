import { beforeEach, describe, expect, it } from "vitest";
import { CHAVE_DA_SESSAO, gravarSessao, lerSessao, novaSessao } from "./sessao";

/** Um `Storage` de mentira: o módulo recebe o storage por parâmetro justamente para isto. */
function storageFalso(inicial: Record<string, string> = {}): Storage {
  const dados = new Map(Object.entries(inicial));
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (k: string) => dados.get(k) ?? null,
    key: (i: number) => [...dados.keys()][i] ?? null,
    removeItem: (k: string) => void dados.delete(k),
    setItem: (k: string, v: string) => void dados.set(k, v),
  };
}

const sessao = novaSessao({
  jornadaId: "produtos-cadastro",
  organizationId: "org_1",
  iniciadaEm: "2026-09-12T10:00:00.000Z",
});

describe("lerSessao", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = storageFalso();
  });

  it("volta o que foi gravado", () => {
    gravarSessao(storage, { ...sessao, passo: 3, apressos: 2 });
    const lida = lerSessao(storage);
    expect(lida?.jornadaId).toBe("produtos-cadastro");
    expect(lida?.passo).toBe(3);
    expect(lida?.apressos).toBe(2);
  });

  it("sem nada gravado, não há jornada", () => {
    expect(lerSessao(storage)).toBeNull();
  });

  it("JSON corrompido não derruba a tela", () => {
    storage.setItem(CHAVE_DA_SESSAO, "{isto não é json");
    expect(lerSessao(storage)).toBeNull();
  });

  it("versão de outra entrega é descartada", () => {
    storage.setItem(CHAVE_DA_SESSAO, JSON.stringify({ ...sessao, versao: 99 }));
    expect(lerSessao(storage)).toBeNull();
  });

  it("faltando campo essencial, descarta", () => {
    storage.setItem(CHAVE_DA_SESSAO, JSON.stringify({ versao: 1, passo: 2 }));
    expect(lerSessao(storage)).toBeNull();
  });

  it("sem storage (servidor, aba anônima) devolve nulo sem lançar", () => {
    expect(lerSessao(null)).toBeNull();
    expect(() => gravarSessao(null, sessao)).not.toThrow();
  });

  it("gravar nulo apaga a jornada", () => {
    gravarSessao(storage, sessao);
    gravarSessao(storage, null);
    expect(lerSessao(storage)).toBeNull();
  });
});
