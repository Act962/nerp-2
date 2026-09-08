import {
  CONSULTOR_TOOL_IDS,
  detalharFerramenta,
  detalharSegmento,
  explicarMetodo,
  resolverIdsDeFerramentas,
} from "@nerp/site-content";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/db";
import { buscarComAFalaDoVisitante } from "./busca";
import { consultarCnpj, type EmpresaPublica } from "./cnpj";
import { type AstroPricing, estimarFaixa } from "./preco";

/**
 * O que o consultor pode fazer.
 *
 * Nenhuma tool deste conjunto alcança dado de inquilino. As de leitura leem
 * constantes compiladas do `@nerp/site-content` — não há como injetar nelas —
 * e a única de escrita toca `site_leads` e `site_chat_sessions`, que são
 * globais e do site. Não existe caminho daqui para `organization`, `user` ou
 * `product`, e é essa ausência, não uma regra do prompt, que segura injeção.
 *
 * A sessão vem em closure, nunca por argumento: se o id da sessão fosse
 * parâmetro de tool, uma mensagem bem escrita gravaria lead na conversa de
 * outra pessoa.
 */

export type ContextoTools = {
  sessaoId: string;
  tabelaPrecos: AstroPricing;
  /**
   * As últimas falas do visitante, com as palavras dele.
   *
   * Existe porque o modelo parafraseia: pedido "o encarte da semana demora
   * dois dias", ele buscou por "criação de materiais promocionais" e a busca
   * devolveu Pages e Planner em vez do Catálogo Promocional. A busca é boa —
   * o que chegou nela é que não era mais a dor do cliente.
   */
  falaDoVisitante: string;
};

/**
 * O formulário de cadastro, que vive fora deste app.
 *
 * O endereço é constante e não passa pelo modelo: LLM que escreve URL escreve
 * URL errada, e aqui errar significa mandar um lead interessado para o vazio.
 * A tool devolve o link pronto e a tela desenha o botão.
 */
const FORMULARIO_URL =
  process.env.SITE_ASTRO_FORM_URL ??
  "https://orbita.nasaex.com/submit-form/cmql16nvi0g4m0uq6mc71lduy?utm_source=direct&utm_medium=referral&utm_campaign=site-formulario";

/** Erro que o modelo consegue ler e contornar, em vez de exceção. */
function erro(mensagem: string, extra: Record<string, unknown> = {}) {
  return { erro: mensagem, ...extra };
}

export function construirTools(contexto: ContextoTools): ToolSet {
  /**
   * As ferramentas que passaram pela conversa nesta requisição.
   *
   * Existe porque pedir a lista ao modelo não funciona: mesmo com o campo
   * obrigatório e descrito, ele registra o diagnóstico com a lista vazia — e
   * aí o lead chega ao time sem dizer o que a pessoa quer, e a faixa sai só na
   * base. O servidor já sabe o que foi mostrado; é ele quem responde.
   */
  const mencionadas = new Set<string>();

  /**
   * Quem está falando, na medida em que ele foi descobrindo.
   *
   * Vive em closure pelo mesmo motivo da sessão: se o nome fosse argumento do
   * fecho, bastaria uma mensagem bem escrita para gravar lead com o nome de
   * outra pessoa. Aqui só entra o que o próprio visitante disse na conversa.
   */
  const visitante: { nome?: string; empresa?: string; cnpj?: string } = {};

  /** A última ficha consultada, para o fecho levá-la sem consultar de novo. */
  let empresaConsultada: EmpresaPublica | null = null;

  return {
    buscarFerramentas: tool({
      description:
        "Encontra as ferramentas da ÓRBITA que resolvem o que o cliente descreveu. Passe a fala dele em `dor`, com as palavras dele. Use SEMPRE antes de recomendar qualquer coisa.",
      inputSchema: z.object({
        dor: z
          .string()
          .max(500)
          .optional()
          .describe("O problema, na linguagem do cliente."),
        segmento: z
          .string()
          .optional()
          .describe("Id do segmento, quando já souber o ramo."),
        categoria: z.string().optional(),
        limite: z.number().int().min(1).max(8).optional(),
      }),
      execute: async (entrada) => {
        const achados = buscarComAFalaDoVisitante(
          entrada,
          contexto.falaDoVisitante,
        );
        for (const achado of achados) mencionadas.add(achado.id);
        if (achados.length === 0) {
          return {
            ferramentas: [],
            aviso:
              "Nada casou com essa descrição. Pergunte de outro jeito, mais concreto, em vez de recomendar no chute.",
          };
        }
        return { ferramentas: achados };
      },
    }),

    detalharFerramenta: tool({
      description:
        "O que uma ferramenta faz: funcionalidades, o que o cliente passa a ter e o que deixa de acontecer. Use antes de descrever qualquer ferramenta — não descreva de memória.",
      inputSchema: z.object({
        id: z.string().describe("O id exato, vindo do índice ou da busca."),
      }),
      execute: async ({ id }) => {
        const detalhe = detalharFerramenta(id);
        if (!detalhe) {
          return erro(`Não existe ferramenta com o id "${id}".`, {
            idsValidos: CONSULTOR_TOOL_IDS,
          });
        }
        mencionadas.add(detalhe.id);
        return detalhe;
      },
    }),

    detalharSegmento: tool({
      description:
        "As ferramentas que costumam pesar num ramo (supermercados, clínicas, food…).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const detalhe = detalharSegmento(id);
        return detalhe ?? erro(`Não existe segmento com o id "${id}".`);
      },
    }),

    explicarMetodo: tool({
      description:
        "O Método N.A.S.A. — as quatro etapas, inteiro ou uma delas. Use quando perguntarem como conduzimos um projeto.",
      inputSchema: z.object({
        etapa: z
          .string()
          .optional()
          .describe("O nome da etapa, ou a posição de 1 a 4. Vazio traz tudo."),
      }),
      execute: async ({ etapa }) => explicarMetodo(etapa),
    }),

    estimarFaixaDePreco: tool({
      description:
        "A faixa de investimento para a operação descrita. É a ÚNICA fonte de valor: nunca escreva preço que não tenha vindo daqui. Chame só depois de saber o porte e os módulos.",
      inputSchema: z.object({
        lojas: z.number().int().min(0).max(10_000).optional(),
        usuarios: z.number().int().min(0).max(100_000).optional(),
        toolIds: z
          .array(z.string())
          .max(28)
          .optional()
          .describe("Ids das ferramentas que entrariam no escopo."),
        porteId: z.string().optional(),
      }),
      execute: async (entrada) => {
        const estimativa = estimarFaixa(contexto.tabelaPrecos, {
          ...entrada,
          toolIds: resolverIdsDeFerramentas(entrada.toolIds ?? []),
        });
        if (!estimativa.disponivel) {
          return {
            disponivel: false,
            instrucao:
              "NÃO diga valor nenhum, nem faixa, nem 'a partir de'. Explique que o valor sai do diagnóstico e ofereça falar com o time.",
          };
        }
        // A memória de cálculo é para o painel, não para a conversa.
        const { memoria: _memoria, ...paraOModelo } = estimativa;
        return paraOModelo;
      },
    }),

    anotarQuemFala: tool({
      description:
        "Guarda quem é a pessoa — nome, empresa, CNPJ — no instante em que ela disser, para você não perguntar duas vezes. Chame mesmo quando a informação vier solta, sem você ter pedido. Anotar não substitui nada: se a mesma mensagem também trouxe um problema, chame `buscarFerramentas` no mesmo turno. Isto NÃO fecha atendimento: fecho é `registrarDiagnostico`.",
      inputSchema: z.object({
        nome: z
          .string()
          .max(80)
          .optional()
          .describe("Como ela se chamou. Só o primeiro nome já serve."),
        empresa: z
          .string()
          .max(160)
          .optional()
          .describe(
            "O NOME da empresa, como ela disse. Ramo não é nome: quem diz 'tenho 3 supermercados' não trabalha numa empresa chamada Supermercados. Na dúvida, deixe vazio.",
          ),
        cnpj: z.string().max(20).optional(),
      }),
      execute: async (entrada) => {
        if (entrada.nome?.trim()) visitante.nome = entrada.nome.trim();
        if (entrada.empresa?.trim()) visitante.empresa = entrada.empresa.trim();
        if (entrada.cnpj?.trim()) visitante.cnpj = entrada.cnpj.trim();
        return {
          anotado: true,
          visitante,
          instrucao:
            "Anotado. Siga a conversa sem comemorar e sem confirmar o que ela acabou de dizer.",
        };
      },
    }),

    consultarCnpj: tool({
      description:
        "A ficha pública de uma empresa pelo CNPJ: ramo (CNAE), porte, natureza jurídica, tempo de casa, cidade e quadro de sócios. Chame quando a pessoa OFERECER o CNPJ. Serve para você entender o negócio dela — não para ler de volta.",
      inputSchema: z.object({
        cnpj: z.string().min(11).max(20),
      }),
      execute: async ({ cnpj }) => {
        const resultado = await consultarCnpj(cnpj);
        if (!resultado.ok) {
          return erro(
            {
              invalido:
                "Esse CNPJ não fecha na conta dos dígitos. Peça para conferir, uma vez só, sem insistir.",
              nao_encontrado:
                "A Receita não tem esse CNPJ. Siga a conversa sem o dado; não vire isso um problema.",
              indisponivel:
                "A consulta não respondeu agora. Não tente de novo nesta conversa: pergunte o ramo e o porte à própria pessoa.",
            }[resultado.motivo],
          );
        }

        empresaConsultada = resultado.empresa;
        visitante.cnpj = resultado.empresa.cnpj;
        visitante.empresa ??=
          resultado.empresa.nomeFantasia ?? resultado.empresa.razaoSocial;

        return {
          empresa: resultado.empresa,
          // Sai junto para a tela guardar: quem já passou o CNPJ não deve
          // ouvir o pedido de novo na página seguinte, e depender de ele
          // lembrar de chamar `anotarQuemFala` no mesmo turno não funciona.
          visitante,
          semQuadroDePessoal:
            "A base pública da Receita não traz número de funcionários. Se precisar saber o tamanho da equipe, pergunte à pessoa.",
          instrucao:
            "Isto é para VOCÊ calibrar o papo — o ramo, o porte, o tempo de casa. NÃO leia a ficha em voz alta, não repita o CNPJ, não cite nome de sócio e não fale em código de CNAE. Uma frase de reconhecimento basta, e o resto vira pergunta melhor.",
        };
      },
    }),

    oferecerFormulario: tool({
      description:
        'Põe o botão "Preencher formulário" na tela. Chame quando a pessoa demonstrar interesse de verdade — quer proposta, quer começar, quer falar com alguém. Não chame para encerrar conversa nem para se livrar de uma pergunta.',
      inputSchema: z.object({
        motivo: z
          .string()
          .max(160)
          .optional()
          .describe("Uma linha sobre o que ela quer. Aparece no cartão."),
      }),
      execute: async ({ motivo }) => ({
        formulario: {
          url: FORMULARIO_URL,
          rotulo: "Preencher formulário",
          motivo: motivo?.trim() ?? "",
        },
        instrucao:
          "O botão já está na tela, logo abaixo da sua resposta. Convide para ele em UMA frase e sem escrever endereço nenhum. A conversa continua depois — o botão não é despedida.",
      }),
    }),

    registrarDiagnostico: tool({
      description:
        "Fecha o atendimento: grava o diagnóstico e o contato para o time dar seguimento. Só chame depois de ter nome E um contato (e-mail ou WhatsApp), e depois de confirmar com a pessoa.",
      inputSchema: z.object({
        nome: z.string().min(2).max(120),
        empresa: z.string().max(160).optional(),
        email: z.string().max(160).optional(),
        telefone: z.string().max(40).optional(),
        segmento: z.string().max(60).optional(),
        lojas: z.number().int().min(0).max(10_000).optional(),
        usuarios: z.number().int().min(0).max(100_000).optional(),
        // Sem `.default([])`: com padrão, o modelo simplesmente omitia o
        // campo, e o lead chegava ao time sem dizer o que a pessoa quer —
        // além de a faixa sair só na base, sem os módulos.
        toolIds: z
          .array(z.string())
          .max(28)
          .describe(
            "Obrigatório. Os ids das ferramentas conversadas, como vieram de `buscarFerramentas`. Lista vazia só se realmente nenhuma foi discutida.",
          ),
        dorPrincipal: z.string().max(600),
        resumo: z
          .string()
          .max(1200)
          .describe("Cinco linhas, no máximo: o que o time precisa saber."),
      }),
      execute: async (entrada) => {
        const email = entrada.email?.trim() || null;
        const telefone = entrada.telefone?.trim() || null;
        if (!email && !telefone) {
          return erro(
            "Falta o contato. Peça e-mail ou WhatsApp antes de registrar.",
          );
        }

        const sessao = await prisma.siteChatSession.findUnique({
          where: { id: contexto.sessaoId },
          select: { id: true, leadId: true },
        });
        if (!sessao) return erro("Sessão expirada.");

        // O modelo passa o id quando lembra e o nome quando não lembra; os
        // dois viram id, e o que não casa com ferramenta nenhuma cai fora.
        // Se ele não passar nada, valem as que a conversa mostrou.
        const doModelo = resolverIdsDeFerramentas(entrada.toolIds);
        const toolIds = doModelo.length > 0 ? doModelo : [...mencionadas];

        const estimativa = estimarFaixa(contexto.tabelaPrecos, {
          lojas: entrada.lojas,
          usuarios: entrada.usuarios,
          toolIds,
        });

        const dados = {
          name: entrada.nome.trim() || visitante.nome || "",
          company:
            entrada.empresa?.trim() ||
            visitante.empresa ||
            empresaConsultada?.razaoSocial ||
            null,
          email,
          phone: telefone,
          segment: entrada.segmento?.trim() || null,
          stores: entrada.lojas ?? null,
          users: entrada.usuarios ?? null,
          toolIds,
          quotedMinCents: estimativa.disponivel ? estimativa.minCents : null,
          quotedMaxCents: estimativa.disponivel ? estimativa.maxCents : null,
          briefing: {
            dorPrincipal: entrada.dorPrincipal,
            resumo: entrada.resumo,
            faixa: estimativa.disponivel ? estimativa.faixa : null,
            memoriaDeCalculo: estimativa.disponivel ? estimativa.memoria : [],
            // A ficha da Receita entra no briefing, não na conversa: para o
            // time comercial é o que dá contexto antes de ligar; para o Astro
            // seria a deixa de recitar cadastro na cara do visitante.
            ...(empresaConsultada ? { empresa: empresaConsultada } : {}),
          },
        };

        // Duas mensagens de fecho na mesma conversa atualizam o mesmo lead, em
        // vez de criar dois — o cliente é um só.
        const lead = sessao.leadId
          ? await prisma.siteLead.update({
              where: { id: sessao.leadId },
              data: dados,
              select: { id: true },
            })
          : await prisma.siteLead.create({ data: dados, select: { id: true } });

        await prisma.siteChatSession.update({
          where: { id: sessao.id },
          data: {
            leadId: lead.id,
            summary: entrada.resumo,
            diagnostic: dados.briefing,
          },
        });

        return {
          registrado: true,
          instrucao:
            "Confirme em uma frase que o time vai entrar em contato e ofereça as duas saídas: falar agora pelo WhatsApp, ou criar o acesso e começar.",
        };
      },
    }),
  };
}
