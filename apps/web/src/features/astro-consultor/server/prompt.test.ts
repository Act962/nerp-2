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

/**
 * O teto vive aqui e não numa constante do código: mexer nele é uma decisão.
 *
 * Foi de 12.000 para 12.500 na Fase 5, quando o canal logado ganhou memória
 * (`lembrar`/`esquecer`/`oQueVoceLembra`) e avisos proativos, cada um com a
 * sua regra no roteiro. A trava existe para pegar um BLOCO entrando sem
 * querer — o texto completo das 28 ferramentas passa de 30 mil caracteres —,
 * não para proibir três linhas de regra por família de tool nova. O canal do
 * site não cresceu e continua perto de 11 mil.
 */
const TETO_CARACTERES = 12_500;

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

  it("no app, o índice de domínios está lá e o teto continua valendo", () => {
    const prompt = montarPrompt({
      escopo: "app",
      agora: AGORA,
      organizacao: "Supermercado Santa Clara",
      usuario: "Weydson (weydson@exemplo.com)",
    });
    // Um domínio de cada bloco: se o índice encolher sem querer, quebra aqui.
    for (const tool of [
      "minhaOperacao",
      "resumoDeVendas",
      "previsaoDeVendas",
      "clientesInativos",
      "estoqueBaixo",
      "proximosEventos",
      "painelDeTrade",
      "previaDeCatalogo",
      "estadoDoWhatsapp",
      "extratoDeStars",
      "contatoDoSuporte",
    ]) {
      expect(prompt, tool).toContain(tool);
    }
    expect(prompt).toContain("Supermercado Santa Clara");
    expect(prompt).toContain("Weydson");
    // Previsão sem método é chute com cara de certeza.
    expect(prompt).toMatch(/método e a confiança/i);
    // No app ele não capta lead: já sabe com quem fala.
    expect(prompt).toMatch(/NÃO pergunta nome/i);
    expect(prompt.length).toBeLessThan(TETO_CARACTERES);
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

describe("com quem ele está falando", () => {
  it("descobre o nome sem virar formulário", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("PRIMEIRO SERVE, DEPOIS PERGUNTA");
    expect(prompt).toMatch(/pergunte UMA vez/i);
    // O ponto do pedido: insistir é o que torna a coleta intromissiva.
    expect(prompt).toMatch(/NÃO pergunte de novo/i);
  });

  // A regra antiga proibia coletar CNPJ junto com CPF e senha. CNPJ é dado
  // público de empresa, e é dele que sai a atividade econômica; CPF continua
  // fora. Separar os dois foi uma decisão, não um relaxamento.
  it("separa CNPJ de documento pessoal", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("consultarCnpj");
    expect(prompt).toMatch(/CPF, senha, cartão e documento pessoal/i);
    expect(prompt).toMatch(/nunca insista/i);
  });

  it("proíbe recitar a ficha da Receita de volta", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toMatch(/nome de sócio que a pessoa não citou/i);
    expect(prompt).toMatch(/não está na base pública/i);
  });

  it("oferece o formulário quando há interesse", () => {
    const prompt = montarPrompt({ escopo: "site", agora: AGORA });
    expect(prompt).toContain("oferecerFormulario");
    expect(prompt).toContain("Preencher formulário");
  });

  it("sem visitante conhecido, o bloco nem aparece", () => {
    expect(montarPrompt({ escopo: "site", agora: AGORA })).not.toContain(
      "[QUEM ESTÁ FALANDO]",
    );
  });

  it("sabendo o nome, manda não perguntar de novo", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      visitante: { nome: "Rafa", empresa: "Santa Clara" },
    });
    expect(prompt).toContain("[QUEM ESTÁ FALANDO]");
    expect(prompt).toContain("O nome dela é Rafa");
    expect(prompt).toContain("Santa Clara");
  });

  it("com CNPJ na mão, não pede de novo nem escreve o número na resposta", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      visitante: { cnpj: "19131243000197" },
    });
    expect(prompt).toMatch(/não escreva o número/i);
    expect(prompt).toContain("19131243000197");
  });
});

/**
 * Memória e avisos: os dois blocos que só existem no canal logado.
 *
 * O que se garante aqui é o isolamento visto do lado do prompt — o canal do
 * site NUNCA recebe memória de organização nenhuma, por mais que quem chame
 * passe uma por engano.
 */
describe("montarPrompt — memória e avisos", () => {
  const MEMORIA = [
    { chave: "reposicao", texto: "A reposição da loja é sempre na terça." },
  ];
  const AVISOS = [
    { titulo: "3 produtos abaixo do mínimo", corpo: "Café, açúcar e leite." },
  ];

  it("no app, memória e avisos entram no prompt", () => {
    const prompt = montarPrompt({
      escopo: "app",
      agora: AGORA,
      memoria: MEMORIA,
      avisos: AVISOS,
    });
    expect(prompt).toContain("sempre na terça");
    expect(prompt).toContain("3 produtos abaixo do mínimo");
    expect(prompt).toMatch(/Não recite a lista|Não recite/i);
  });

  it("no site, memória e avisos NUNCA entram — nem passados de propósito", () => {
    const prompt = montarPrompt({
      escopo: "site",
      agora: AGORA,
      memoria: MEMORIA,
      avisos: AVISOS,
    });
    expect(prompt).not.toContain("sempre na terça");
    expect(prompt).not.toContain("3 produtos abaixo do mínimo");
  });

  it("sem memória e sem aviso, nenhum cabeçalho vazio sobra", () => {
    const prompt = montarPrompt({ escopo: "app", agora: AGORA });
    expect(prompt).not.toContain("[AVISOS ABERTOS]");
    expect(prompt).not.toContain("[O QUE VOCÊ JÁ SABE DESTA EMPRESA]");
  });

  it("a memória é cortada por tamanho, não pela contagem de fatos", () => {
    const gordos = Array.from({ length: 40 }, (_, i) => ({
      chave: `fato-${i}`,
      texto: "x".repeat(200),
    }));
    const prompt = montarPrompt({
      escopo: "app",
      agora: AGORA,
      memoria: gordos,
    });
    // Entra alguma coisa, mas não os 8.000 caracteres da lista inteira.
    expect(prompt).toContain("fato-0");
    expect(prompt).not.toContain("fato-30");
  });

  it("o prompt com memória e avisos continua abaixo do teto", () => {
    const prompt = montarPrompt({
      escopo: "app",
      agora: AGORA,
      organizacao: "Supermercado Santa Clara",
      usuario: "Weydson (weydson@exemplo.com)",
      memoria: Array.from({ length: 20 }, (_, i) => ({
        chave: `fato-${i}`,
        texto: "Um fato de tamanho normal sobre a operação desta loja.",
      })),
      avisos: Array.from({ length: 5 }, (_, i) => ({
        titulo: `Aviso ${i}`,
        corpo: "Um corpo de aviso do tamanho que o motor costuma gerar aqui.",
      })),
    });
    expect(prompt.length).toBeLessThan(TETO_CARACTERES + 2_000);
  });
});
