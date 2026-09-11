import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
} from "@/features/astro-consultor/server/provider";
import { saldoDoOrcamento } from "@/features/site/lib/custo-gemini";
import { arredondarEstrelas, emEstrelas } from "@/features/stars/lib/decimal";
import {
  AcaoDesconhecidaError,
  cobrancaEstaAtiva,
  gravarRegra,
  lerRegras,
} from "@/features/stars/server/regras";
import { creditar } from "@/features/stars/server/debitar";
import {
  diagnosticarAstro,
  reiniciarAstroDaOrg,
  testarProvedor,
} from "@/features/site/server/reiniciar-astro";
import {
  DIAS_DE_CATALOGO_ATIVO,
  DIAS_SEM_GERIR,
  empresasComConsumo,
  resumoDaPlataforma,
} from "@/features/site/server/painel-das-empresas";
import prisma from "@/lib/db";

/**
 * O painel de controle da plataforma: todas as empresas e o que elas custam.
 *
 * É a única parte do router que lê através das organizações, e por isso a
 * guarda é a do SITE (`requireSiteAdminMiddleware`), não a de organização. As
 * consultas ficam em `features/site/server/painel-das-empresas.ts`, onde a
 * ausência de `organizationId` é o contrato e não um esquecimento.
 *
 * A cotação do dólar e o orçamento saem da mesma configuração que converte
 * custo em ★ (`astro-config`): um segundo lugar para digitar a cotação faria
 * o painel e a cobrança divergirem no dia em que alguém atualizasse só um.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

async function configuracaoDoAstro() {
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  return lerConfig(linha?.value);
}

const gastoSchema = z.object({
  custoDolar: z.number(),
  custoReal: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  sessoes: z.number(),
  semModelo: z.number(),
});

const PERIODO = z.object({
  dias: z.number().int().min(1).max(365).default(30),
});

export const resumoDaPlataformaProcedure = siteAdmin
  .route({
    method: "GET",
    summary: "Indicadores de todas as empresas",
    tags: ["Plataforma"],
  })
  .input(PERIODO)
  .output(
    z.object({
      empresas: z.object({
        total: z.number(),
        ativas: z.number(),
        deTeste: z.number(),
        paradas: z.number(),
      }),
      vendas: z.object({ valorTotal: z.number(), quantidade: z.number() }),
      catalogos: z.object({ montados: z.number(), ativos: z.number() }),
      stars: z.object({
        consumidasNoPeriodo: z.number(),
        saldoEmCirculacao: z.number(),
      }),
      gemini: gastoSchema,
      mes: z.object({ gasto: gastoSchema, desde: z.string() }),
      orcamento: z
        .object({
          totalReais: z.number(),
          restante: z.number(),
          percentual: z.number(),
        })
        .nullable(),
      periodo: z.object({ de: z.string(), ate: z.string(), dias: z.number() }),
      /** A cotação usada, para a tela poder dizer que o real é convertido. */
      dolar: z.number(),
      criterios: z.object({
        diasSemGerir: z.number(),
        diasDeCatalogoAtivo: z.number(),
      }),
    }),
  )
  .handler(async ({ input }) => {
    const config = await configuracaoDoAstro();
    const resumo = await resumoDaPlataforma({
      dias: input.dias,
      dolar: config.dolar,
    });

    const saldo = saldoDoOrcamento(
      resumo.mes.gasto.custoReal,
      config.orcamentoMensalReais,
    );

    return {
      ...resumo,
      orcamento: saldo
        ? { totalReais: config.orcamentoMensalReais, ...saldo }
        : null,
      dolar: config.dolar,
      criterios: {
        diasSemGerir: DIAS_SEM_GERIR,
        diasDeCatalogoAtivo: DIAS_DE_CATALOGO_ATIVO,
      },
    };
  });

export const empresasDaPlataforma = siteAdmin
  .route({
    method: "GET",
    summary: "Consumo por empresa",
    tags: ["Plataforma"],
  })
  .input(PERIODO)
  .output(
    z.object({
      empresas: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          slug: z.string(),
          criadaEm: z.string(),
          ultimoAcesso: z.string().nullable(),
          contaDeTeste: z.boolean(),
          parada: z.boolean(),
          saldo: z.number(),
          consumoNoPeriodo: z.number(),
          tokens: z.number(),
          custoGeminiReal: z.number(),
          vendas: z.number(),
          catalogos: z.number(),
        }),
      ),
      dolar: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const config = await configuracaoDoAstro();
    const empresas = await empresasComConsumo({
      dias: input.dias,
      dolar: config.dolar,
    });
    return { empresas, dolar: config.dolar };
  });

/**
 * Crédito manual de ★ numa empresa.
 *
 * Existe porque o suporte precisa devolver ★ que o cliente perdeu por um erro
 * nosso, e liberar cortesia para quem está avaliando — hoje isso só se fazia
 * no banco, à mão.
 *
 * Três decisões deliberadas:
 *
 * - **Só credita.** Tirar ★ de uma organização por uma tela de admin é o tipo
 *   de operação que precisa de mais cuidado do que um input e um botão, e
 *   nenhum caso de suporte pediu isso ainda.
 * - **Passa pelo mesmo `creditar`** que o crédito do plano e a compra de
 *   pacote: saldo e extrato mudam na MESMA transação. Um `update` direto no
 *   saldo daria uma organização com ★ que não aparecem em lugar nenhum.
 * - **Grava quem creditou** em `userId`, e o motivo na descrição. Ajuste
 *   manual sem autor é o registro que ninguém consegue explicar seis meses
 *   depois.
 */
export const creditarStars = siteAdmin
  .route({
    method: "POST",
    summary: "Creditar ★ manualmente numa empresa",
    tags: ["Plataforma"],
  })
  .input(
    z.object({
      organizationId: z.string().min(1),
      /** Em ★, com as duas casas que o saldo aceita. */
      valor: z.number().positive().max(100_000),
      motivo: z.string().trim().min(3, "Diga o motivo").max(140),
    }),
  )
  .output(
    z.object({
      saldo: z.number(),
      nome: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw errors.NOT_FOUND({ message: "Empresa não encontrada" });

    const valor = arredondarEstrelas(input.valor);
    if (valor <= 0) {
      throw errors.BAD_REQUEST({
        message: "O valor precisa ser maior que zero",
      });
    }

    const saldo = await creditar({
      organizationId: org.id,
      valor,
      tipo: "MANUAL_ADJUST",
      descricao: `Crédito manual do admin: ${input.motivo}`,
      userId: context.user.id,
    });

    return { saldo: emEstrelas(saldo), nome: org.name };
  });

/**
 * Por que o Astro de uma empresa não responde.
 *
 * Chama as mesmas travas da rota, na mesma ordem — ver
 * `features/site/server/reiniciar-astro.ts`.
 */
export const diagnosticoDoAstro = siteAdmin
  .route({
    method: "GET",
    summary: "Por que o Astro não responde nesta empresa",
    tags: ["Plataforma"],
  })
  .input(z.object({ organizationId: z.string().min(1) }))
  .output(
    z.object({
      motivo: z.enum([
        "ok",
        "desligado",
        "sem_chave",
        "teto_diario",
        "sem_saldo",
      ]),
      saldo: z.number(),
      mensagensNoDia: z.number(),
      tetoPorOrg: z.number(),
      sessoesAbertas: z.number(),
      memorias: z.number(),
      ultimaConversa: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const existe = await prisma.organization.count({
      where: { id: input.organizationId },
    });
    if (existe === 0) {
      throw errors.NOT_FOUND({ message: "Empresa não encontrada" });
    }
    return diagnosticarAstro(input.organizationId);
  });

/**
 * Reinicia o Astro de uma empresa.
 *
 * Encerra as conversas abertas no servidor e, sob pedido, libera o teto do dia
 * e apaga a memória. **Não** apaga o histórico da aba de quem está falando —
 * isso mora no navegador, e quem limpa é o "Recomeçar" do widget.
 */
export const reiniciarAstro = siteAdmin
  .route({
    method: "POST",
    summary: "Reiniciar o Astro de uma empresa",
    tags: ["Plataforma"],
  })
  .input(
    z.object({
      organizationId: z.string().min(1),
      liberarTeto: z.boolean().default(false),
      apagarMemoria: z.boolean().default(false),
    }),
  )
  .output(
    z.object({
      sessoesEncerradas: z.number(),
      contadorZerado: z.number(),
      memoriasApagadas: z.number(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const existe = await prisma.organization.count({
      where: { id: input.organizationId },
    });
    if (existe === 0) {
      throw errors.NOT_FOUND({ message: "Empresa não encontrada" });
    }
    return reiniciarAstroDaOrg(input);
  });

/**
 * Bate na porta do provedor de IA de verdade.
 *
 * Separada do diagnóstico porque é chamada paga: roda no botão, não ao abrir a
 * tela. É o teste que distingue "tem chave" de "a chave funciona".
 */
export const testarChaveDoAstro = siteAdmin
  .route({
    method: "POST",
    summary: "Testar a chave de IA contra o provedor",
    tags: ["Plataforma"],
  })
  .input(z.object({}))
  .output(
    z.object({
      modelos: z.array(
        z.object({
          nivel: z.string(),
          modelo: z.string(),
          ok: z.boolean(),
          erro: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async () => ({ modelos: await testarProvedor() }));

const regraSchema = z.object({
  actionKey: z.string(),
  label: z.string(),
  descricao: z.string(),
  stars: z.number(),
  isActive: z.boolean(),
});

/**
 * O preço das ações de UMA empresa, para o administrador da plataforma.
 *
 * O mesmo `lerRegras` que a organização usa para ler — o que muda é a guarda e
 * de onde vem o `organizationId`. Editar preço saiu de dentro da organização
 * porque é decisão comercial da casa: com a tela lá, um cliente podia zerar o
 * próprio preço e usar o Astro de graça sem nada aparecer no painel.
 */
export const precosDaEmpresa = siteAdmin
  .route({
    method: "GET",
    summary: "Preço das ações de uma empresa",
    tags: ["Plataforma"],
  })
  .input(z.object({ organizationId: z.string().min(1) }))
  .output(
    z.object({ cobrancaAtiva: z.boolean(), regras: z.array(regraSchema) }),
  )
  .handler(async ({ input, errors }) => {
    const existe = await prisma.organization.count({
      where: { id: input.organizationId },
    });
    if (existe === 0) {
      throw errors.NOT_FOUND({ message: "Empresa não encontrada" });
    }
    const regras = await lerRegras(input.organizationId);
    return { cobrancaAtiva: cobrancaEstaAtiva(regras), regras };
  });

export const definirPrecoDaEmpresa = siteAdmin
  .route({
    method: "POST",
    summary: "Define o preço de uma ação numa empresa",
    tags: ["Plataforma"],
  })
  .input(
    z.object({
      organizationId: z.string().min(1),
      actionKey: z.string().min(1),
      /**
       * ★ por ação. Zero desliga a cobrança dela.
       *
       * Fracionado de propósito: o preço por bloco de tokens do Astro não cabe
       * em inteiro — 1 ★ por mil tokens é caro demais e 0 desliga.
       */
      stars: z.number().min(0).max(1000),
    }),
  )
  .output(
    z.object({
      actionKey: z.string(),
      stars: z.number(),
      cobrancaAtiva: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const existe = await prisma.organization.count({
      where: { id: input.organizationId },
    });
    if (existe === 0) {
      throw errors.NOT_FOUND({ message: "Empresa não encontrada" });
    }
    try {
      return await gravarRegra(input);
    } catch (erro) {
      if (erro instanceof AcaoDesconhecidaError) {
        throw errors.NOT_FOUND({ message: "Ação desconhecida" });
      }
      throw erro;
    }
  });
