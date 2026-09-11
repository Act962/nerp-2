import { describe, expect, it } from "vitest";
import type { AstroPricing } from "@/features/astro-consultor/server/preco";
import type { ModeloResolvido } from "@/features/astro-consultor/server/provider";
import { construirToolsDeBuscaWeb } from "./busca-web";

/**
 * Busca na web é tool do PROVEDOR. Com a OpenAI atendendo, ela não existe — e
 * o que se garante aqui é que ela some do conjunto em vez de aparecer e
 * quebrar na primeira chamada, e que os nomes são exatamente os que o Google
 * reconhece.
 */

const CONTEXTO_BASE = {
  organizationId: "org_a",
  userId: "user_a",
  sessaoId: "sessao",
  tabelaPrecos: {} as AstroPricing,
  falaDoVisitante: "",
};

function modeloFalso(provedor: "google" | "openai"): ModeloResolvido {
  const google = {
    tools: {
      googleSearch: () => ({ type: "provider-defined", name: "google_search" }),
      urlContext: () => ({ type: "provider-defined", name: "url_context" }),
    },
  } as unknown as NonNullable<ModeloResolvido["google"]>;

  return {
    modelo: "modelo-de-mentira" as unknown as ModeloResolvido["modelo"],
    nome: provedor === "google" ? "gemini-2.5-flash" : "gpt-5",
    provedor,
    ...(provedor === "google" ? { google } : {}),
  };
}

describe("construirToolsDeBuscaWeb", () => {
  it("com o Google, entrega as duas tools com os nomes que o provedor exige", () => {
    const tools = construirToolsDeBuscaWeb({
      ...CONTEXTO_BASE,
      modelo: modeloFalso("google"),
    });
    expect(Object.keys(tools).sort()).toEqual(["google_search", "url_context"]);
  });

  it("com a OpenAI, o conjunto sai vazio", () => {
    const tools = construirToolsDeBuscaWeb({
      ...CONTEXTO_BASE,
      modelo: modeloFalso("openai"),
    });
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("sem modelo no contexto, também vazio — nada de tool sem provedor", () => {
    expect(Object.keys(construirToolsDeBuscaWeb(CONTEXTO_BASE))).toHaveLength(
      0,
    );
  });
});
