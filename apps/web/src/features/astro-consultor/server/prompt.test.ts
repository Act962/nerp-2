import { CONSULTOR_TOOL_IDS } from "@nerp/site-content";
import { describe, expect, it } from "vitest";
import { montarPrompt } from "./prompt";

/**
 * O prompt é pago em toda mensagem de toda conversa. Um bloco grande que entre
 * aqui sem querer — o texto completo das 28 ferramentas, por exemplo — não
 * quebra nada: só multiplica a conta, em silêncio, até a fatura. Daí a trava
 * de tamanho.
 */

const AGORA = new Date("2026-09-04T12:00:00.000Z");

/** O teto vive aqui e não numa constante do código: mexer nele é uma decisão. */
const TETO_CARACTERES = 12_000;

describe("montarPrompt", () => {
  it("cabe no teto de tamanho", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt.length).toBeLessThan(TETO_CARACTERES);
  });

  it("traz as 28 ferramentas, para o modelo não inventar uma 29ª", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    for (const id of CONSULTOR_TOOL_IDS) {
      expect(prompt, id).toContain(`${id} |`);
    }
  });

  it("proíbe preço inventado com todas as letras", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("estimarFaixaDePreco");
    expect(prompt).toMatch(/nunca invente/i);
  });

  it("carrega as defesas contra instrução vinda da conversa", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("modo desenvolvedor");
    expect(prompt).toMatch(/ignora qualquer instrução/i);
  });

  it("diz a data, que o modelo não tem como saber", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("Fortaleza");
    expect(prompt).toContain("2026");
  });

  it("no site, avisa que não enxerga dado de cliente nenhum", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("não tem acesso a dado nenhum de cliente");
    expect(prompt).not.toContain("modulosContratados");
  });

  it("no app, usa as ferramentas do cliente logado", () => {
    const prompt = montarPrompt({
      escopo: "app",
      agora: AGORA,
      organizacao: "Supermercado Santa Clara",
    });
    expect(prompt).toContain("modulosContratados");
    expect(prompt).toContain("Supermercado Santa Clara");
  });

  it("o mesmo instante gera o mesmo prompt", () => {
    expect(montarPrompt({ escopo: "site", agora: AGORA })).toBe(
      montarPrompt({ escopo: "site", agora: AGORA }),
    );
  });
});

describe("montarPrompt — onde a pessoa está", () => {
  const PAGINA = {
    slug: "crm-tracking",
    titulo: "CRM Tracking",
    palavrasChave: ["funil", "kanban", "lead"],
    resumo: "O funil que anda quando o card anda.",
  };

  it("sem navegação, o bloco nem aparece", () => {
    expect(montarPrompt({ escopo: "site", agora: AGORA })).not.toContain(
      "[ONDE A PESSOA ESTÁ]",
    );
  });

  it("diz a página, o resumo do admin e as palavras-chave", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      navegacao: { pagina: PAGINA },
    });
    expect(prompt).toContain("CRM Tracking");
    expect(prompt).toContain("O funil que anda quando o card anda.");
    expect(prompt).toContain("funil, kanban, lead");
  });

  it("conta por onde ela passou, menos a página atual", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      navegacao: {
        pagina: PAGINA,
        trilha: [
          { slug: "pdv", titulo: "PDV" },
          { slug: "estoque", titulo: "Estoque" },
          { slug: "crm-tracking", titulo: "CRM Tracking" },
        ],
      },
    });
    expect(prompt).toContain("PDV → Estoque");
    // A última da trilha é onde ela está agora; repeti-la seria dizer que ela
    // "passou" pela página que está lendo.
    expect(prompt).not.toContain("Estoque → CRM Tracking");
  });

  it("proíbe recitar a trilha como relatório", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      navegacao: { pagina: PAGINA },
    });
    expect(prompt).toMatch(/não recite a trilha/i);
    expect(prompt).toMatch(/rastreando/i);
  });
});

describe("o tom da casa", () => {
  it("é informal e brincalhão, mas não em cima da dor", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toMatch(/informal/i);
    expect(prompt).toMatch(/brincalhão/i);
    expect(prompt).toContain("Piada em cima da dor de alguém");
  });
});

describe("promessa de resultado", () => {
  // Numa conversa real ele disse que o TrafeGO "faz a verba render mais" —
  // promessa sobre o negócio da pessoa, que a regra editorial do site proíbe.
  // A regra vivia no bloco de estilo, que é mais frouxo; virou regra dura.
  it("é proibida com exemplos, e não só no bloco de estilo", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("NADA DE PROMESSA DE RESULTADO");
    expect(prompt).toContain("faz a verba render mais");
    expect(prompt).toMatch(/piada pode, promessa não/i);
  });
});
