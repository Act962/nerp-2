import { describe, expect, it } from "vitest";
import {
  anexosDasMensagens,
  chaveDoAnexo,
  conferirAnexos,
  MAX_ANEXOS_POR_MENSAGEM,
  type ParteDeArquivo,
  prefixoPublicoDaOrg,
  tipoDeAnexoAceito,
} from "./anexos";

/**
 * A regra que este arquivo protege é uma só: um anexo vale se estiver dentro
 * do prefixo da PRÓPRIA organização. O histórico da conversa é postado pelo
 * navegador a cada mensagem, então "de onde vem esta imagem" é uma pergunta
 * que o servidor precisa responder sozinho.
 */

const HOST = "assets.exemplo.test";
const ORG = "org_a";

function imagem(url: string, mediaType = "image/png"): ParteDeArquivo {
  return { type: "file", mediaType, url };
}

describe("conferirAnexos", () => {
  it("aceita imagem dentro do prefixo da organização", () => {
    const veredito = conferirAnexos(
      [imagem(`https://${HOST}/${ORG}/astro/foto.png`)],
      ORG,
      HOST,
    );
    expect(veredito.ok).toBe(true);
  });

  it("recusa imagem do bucket de outra organização", () => {
    const veredito = conferirAnexos(
      [imagem(`https://${HOST}/org_b/astro/foto.png`)],
      ORG,
      HOST,
    );
    expect(veredito).toEqual({
      ok: false,
      motivo: "Este anexo não pertence à sua organização.",
    });
  });

  it("recusa endereço arbitrário da internet", () => {
    const veredito = conferirAnexos(
      [imagem("https://exemplo.test/qualquer-coisa.png")],
      ORG,
      HOST,
    );
    expect(veredito.ok).toBe(false);
  });

  it("recusa prefixo que só PARECE o da organização", () => {
    // `org_a2` começa com `org_a`; sem a barra no prefixo, passaria.
    const veredito = conferirAnexos(
      [imagem(`https://${HOST}/org_a2/foto.png`)],
      ORG,
      HOST,
    );
    expect(veredito.ok).toBe(false);
  });

  it("recusa tipo fora da lista, mesmo no prefixo certo", () => {
    const veredito = conferirAnexos(
      [imagem(`https://${HOST}/${ORG}/astro/mapa.svg`, "image/svg+xml")],
      ORG,
      HOST,
    );
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) expect(veredito.motivo).toMatch(/JPEG, PNG ou WebP/);
  });

  it("recusa mais imagens do que cabe numa mensagem", () => {
    const partes = Array.from({ length: MAX_ANEXOS_POR_MENSAGEM + 1 }, (_, i) =>
      imagem(`https://${HOST}/${ORG}/astro/${i}.png`),
    );
    const veredito = conferirAnexos(partes, ORG, HOST);
    expect(veredito.ok).toBe(false);
  });

  it("sem bucket configurado, nenhum anexo passa", () => {
    const veredito = conferirAnexos(
      [imagem(`https://${HOST}/${ORG}/foto.png`)],
      ORG,
      undefined,
    );
    expect(veredito.ok).toBe(false);
    expect(prefixoPublicoDaOrg(ORG, undefined)).toBeNull();
  });

  it("mensagem sem anexo nenhum passa", () => {
    expect(conferirAnexos([], ORG, HOST)).toEqual({ ok: true });
  });
});

describe("tipoDeAnexoAceito", () => {
  it("aceita a lista fechada, sem se importar com caixa", () => {
    expect(tipoDeAnexoAceito("IMAGE/JPEG")).toBe(true);
    expect(tipoDeAnexoAceito("image/webp")).toBe(true);
    expect(tipoDeAnexoAceito("application/pdf")).toBe(false);
    expect(tipoDeAnexoAceito("image/gif")).toBe(false);
  });
});

describe("anexosDasMensagens", () => {
  it("colhe só as partes de arquivo, sem confiar na forma do corpo", () => {
    const anexos = anexosDasMensagens([
      { parts: [{ type: "text", text: "olha" }] },
      {
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            url: "u1",
            filename: "a.png",
          },
          null,
          "isto não é parte",
          { type: "file" },
        ],
      },
      { sem: "parts" },
    ]);

    expect(anexos).toHaveLength(2);
    expect(anexos[0]).toEqual({
      type: "file",
      mediaType: "image/png",
      url: "u1",
      filename: "a.png",
    });
    // Parte de arquivo sem campo nenhum vira string vazia, não `undefined`
    // solto — o que a faz cair na conferência em vez de escapar dela.
    expect(anexos[1]).toEqual({
      type: "file",
      mediaType: "",
      url: "",
      filename: undefined,
    });
  });
});

describe("chaveDoAnexo", () => {
  it("devolve a chave quando o endereço já é do bucket da organização", () => {
    expect(
      chaveDoAnexo(`https://${HOST}/${ORG}/astro/foto.png`, ORG, HOST),
    ).toBe(`${ORG}/astro/foto.png`);
  });

  it("devolve nulo para endereço de fora — ali é para baixar", () => {
    expect(chaveDoAnexo("https://exemplo.test/foto.png", ORG, HOST)).toBeNull();
    expect(
      chaveDoAnexo(`https://${HOST}/org_b/foto.png`, ORG, HOST),
    ).toBeNull();
  });
});
