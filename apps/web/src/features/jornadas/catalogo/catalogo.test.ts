import { describe, expect, it } from "vitest";
import { PAGE_PERMISSION_KEYS } from "@/lib/permissions";
import { JORNADAS, jornadaPorId, jornadasQueComecamEm } from "./index";

describe("catálogo de jornadas", () => {
  it("não repete id — o id é a chave do progresso e do preço", () => {
    const ids = JORNADAS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda jornada aponta para um módulo que existe", () => {
    for (const jornada of JORNADAS) {
      expect(PAGE_PERMISSION_KEYS).toContain(jornada.modulo);
    }
  });

  it("todo passo tem o que precisa para o motor achar o alvo", () => {
    for (const jornada of JORNADAS) {
      expect(jornada.passos.length).toBeGreaterThan(0);
      for (const passo of jornada.passos) {
        if (passo.tipo === "navegar") {
          expect(
            passo.destino,
            `${jornada.id}: navegar sem destino`,
          ).toBeTruthy();
        } else {
          expect(
            passo.alvo,
            `${jornada.id}: ${passo.tipo} sem alvo`,
          ).toBeTruthy();
        }
        expect(passo.titulo.length).toBeGreaterThan(0);
        expect(passo.texto.length).toBeGreaterThan(0);
      }
    }
  });

  it("o passo que depende de sub-item do menu manda abrir o grupo antes", () => {
    for (const jornada of JORNADAS) {
      for (const passo of jornada.passos) {
        if (passo.precisaDaSidebar && passo.alvo?.startsWith("sidebar-")) {
          // Sem isto o `Collapsible` fechado esconde o alvo e a jornada trava.
          expect(passo.abrirAntes, `${jornada.id}/${passo.alvo}`).toBeTruthy();
        }
      }
    }
  });

  it("toda jornada sugere um valor em ★", () => {
    for (const jornada of JORNADAS) {
      expect(jornada.starsSugeridas).toBeGreaterThan(0);
    }
  });

  it("acha pelo id, e não inventa o que não existe", () => {
    expect(jornadaPorId("produtos-cadastro")?.modulo).toBe("produtos");
    expect(jornadaPorId("jornada-que-nao-existe")).toBeNull();
  });

  it("encontra as jornadas da tela", () => {
    expect(jornadasQueComecamEm("/produtos").map((j) => j.id)).toEqual([
      "produtos-cadastro",
    ]);
    expect(jornadasQueComecamEm("/clientes").map((j) => j.id)).toEqual([
      "clientes-cadastro",
    ]);
    // Tela sem jornada não devolve nada — é o que faz o convite não aparecer.
    expect(jornadasQueComecamEm("/sem-acesso")).toEqual([]);
  });

  it("nenhuma tela tem duas jornadas competindo pelo convite", () => {
    const porRota = new Map<string, string[]>();
    for (const jornada of JORNADAS) {
      porRota.set(jornada.rota, [
        ...(porRota.get(jornada.rota) ?? []),
        jornada.id,
      ]);
    }
    for (const [rota, ids] of porRota) {
      // O convite flutuante oferece a PRIMEIRA candidata; duas na mesma tela
      // esconderiam uma delas sem ninguém perceber.
      expect(ids, `duas jornadas em ${rota}`).toHaveLength(1);
    }
  });

  it("depois de um passo que navega, o seguinte declara a tela nova", () => {
    for (const jornada of JORNADAS) {
      jornada.passos.forEach((passo, i) => {
        if (passo.tipo !== "navegar") return;
        const seguinte = jornada.passos[i + 1];
        if (!seguinte) return;
        // Herdar a rota da jornada aqui aponta o passo para a tela ANTERIOR, e
        // o motor fica avisando que não achou o alvo numa tela que já trocou.
        expect(
          seguinte.rota,
          `${jornada.id}: o passo ${i + 2} vem depois de navegar e não declara rota`,
        ).toBe(passo.destino);
      });
    }
  });

  it("todo passo aponta para a tela onde ele acontece", () => {
    for (const jornada of JORNADAS) {
      for (const passo of jornada.passos) {
        if (passo.tipo === "navegar") continue;
        const rota = passo.rota ?? jornada.rota;
        expect(rota.startsWith("/"), `${jornada.id}: rota ${rota}`).toBe(true);
      }
    }
  });
});
