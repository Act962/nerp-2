import "server-only";

import { type LanguageModel, Output, generateText } from "ai";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  ASTRO_CONFIG_KEY,
  googleDisponivel,
  lerConfig,
  openaiDisponivel,
} from "@/features/astro-consultor/server/provider";
import {
  type BaseDeCobranca,
  custoDaResposta,
  modeloPorId,
} from "@/features/astro/server/modelos";
import { arredondarEstrelas, emEstrelas } from "@/features/stars/lib/decimal";
import { ACOES, cobrarAteOSaldo } from "@/features/stars/server/debitar";
import {
  CLIMAS_OFERTA,
  FORMATOS_OFERTA,
  catalogoDaOferta,
  comporOferta,
} from "../lib/compor-oferta";
import {
  type NivelOferta,
  type OfertaDesenhada,
  type PedidoDeOferta,
  FALLBACK_GEMINI_DO_NIVEL,
  aplicarDesenho,
  modeloDoNivelDeOferta,
  ofertaDesenhadaSchema,
  tokensEstimados,
} from "../lib/oferta-desenhada";
import { PROPORCAO_DO_CARD_PADRAO } from "../etiqueta-padrao";
import { type CardLayoutElement, DEFAULT_CONFIG } from "../types";
import { gerarArteDaOferta } from "./gerar-arte";
import { resolvePromotionalProducts } from "./resolve-products";

/** O que a procedure grava em `PromotionalOfferGeneration.input`. */
export type EntradaDaGeracao = {
  pedido: PedidoDeOferta;
  nome: string;
  estiloLivre: boolean;
};

/** O que fica em `resultado` quando termina. */
export type ResultadoDaGeracao = {
  /** Parâmetros finais do compositor — o editor compõe com eles. */
  entrada: ReturnType<typeof aplicarDesenho>;
  desenho: OfertaDesenhada;
  /** Catálogo NOVO criado pela geração (só quando não havia `catalogId`). */
  catalogoCriado?: string;
};

async function baseDeCobranca(): Promise<BaseDeCobranca> {
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  const config = lerConfig(linha?.value);
  return { dolar: config.dolar, realPorEstrela: config.realPorEstrela };
}

/**
 * O preço de uma geração em ★. A `StarRule` de `astro_oferta_pagina`, quando
 * existe, manda (inclusive zero, para desligar). Sem regra, é o custo real do
 * modelo do nível com a margem do Astro.
 */
async function precoDaGeracao(
  organizationId: string,
  modelo: string,
  tokensIn: number,
  tokensOut: number,
): Promise<number> {
  const regra = await prisma.starRule.findUnique({
    where: {
      organizationId_actionKey: {
        organizationId,
        actionKey: ACOES.astroOferta,
      },
    },
    select: { stars: true, isActive: true },
  });
  if (regra) return regra.isActive ? Math.max(0, emEstrelas(regra.stars)) : 0;
  const def = modeloPorId(modelo);
  if (!def) return 0;
  return arredondarEstrelas(
    custoDaResposta({
      modelo: def,
      tokensIn,
      tokensOut,
      base: await baseDeCobranca(),
    }).estrelas,
  );
}

/** Estimativa ANTES de gerar — o número que o assistente mostra. */
export async function estimarGeracao(
  organizationId: string,
  nivel: NivelOferta,
  produtos: number,
): Promise<number> {
  const { tokensIn, tokensOut } = tokensEstimados(produtos);
  return precoDaGeracao(
    organizationId,
    modeloDoNivelDeOferta(nivel),
    tokensIn,
    tokensOut,
  );
}

/**
 * Os modelos a tentar, em ordem: o da OpenAI do nível e, de fallback, o
 * Gemini do mesmo porte. Só entra quem tem chave.
 */
function candidatosDeTexto(
  nivel: NivelOferta,
): { id: string; modelo: LanguageModel }[] {
  const lista: { id: string; modelo: LanguageModel }[] = [];
  const openai = openaiDisponivel();
  if (openai) {
    const id = modeloDoNivelDeOferta(nivel);
    lista.push({ id, modelo: openai(id) });
  }
  const google = googleDisponivel();
  if (google) {
    const id = FALLBACK_GEMINI_DO_NIVEL[nivel];
    lista.push({ id, modelo: google(id) });
  }
  return lista;
}

/** Há IA para o nível? OpenAI, ou o Gemini de fallback. */
export function iaDisponivel(nivel: NivelOferta): boolean {
  return candidatosDeTexto(nivel).length > 0;
}

function montarPrompt(
  entrada: EntradaDaGeracao,
  produtos: {
    id: string;
    name: string;
    categoryName: string | null;
    de: number;
    por: number | null;
  }[],
): string {
  const { pedido } = entrada;
  const formato = FORMATOS_OFERTA.find((f) => f.value === pedido.formato);
  const linhas = produtos.map((p) => {
    const desconto =
      p.por != null && p.de > 0 ? Math.round((1 - p.por / p.de) * 100) : 0;
    return `- ${p.id} | ${p.name} | ${p.categoryName ?? "sem categoria"} | De R$ ${p.de.toFixed(2)}${p.por != null ? ` | Por R$ ${p.por.toFixed(2)} (-${desconto}%)` : ""}`;
  });
  return [
    `Oferta: "${pedido.oferta.nome}"`,
    pedido.oferta.chamada
      ? `Chamada do cliente: "${pedido.oferta.chamada}"`
      : "",
    pedido.oferta.validade ? `Validade: ${pedido.oferta.validade}` : "",
    `Formato: ${formato?.label ?? pedido.formato}`,
    entrada.estiloLivre
      ? `Estilos possíveis: ${CLIMAS_OFERTA.map((c) => `${c.value} (${c.label})`).join(", ")}. Escolha o que combina com os produtos e a data.`
      : `Estilo já escolhido pelo cliente: ${pedido.clima}, cor ${pedido.corBase ?? "padrão"} — repita esses valores.`,
    "",
    "Produtos (id | nome | categoria | preços):",
    ...linhas,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

const INSTRUCOES = `Você é diretor de arte de encartes de supermercado e varejo no Brasil.
Monte a página de oferta escolhendo parâmetros — você NÃO desenha, só escolhe.
- molde "destaque" quando houver um produto claramente mais forte (maior desconto ou mais conhecido); senão "grade".
- ordem: todos os ids recebidos, o mais atrativo primeiro. Não invente ids.
- chamada: português do Brasil, curta (até 50 letras), sem repetir o nome da oferta, sem emojis e sem prometer o que não está nos preços.
- corBase: hexadecimal #RRGGBB que combine com o estilo e os produtos.`;

/**
 * Passo 1 da função: a chamada ao modelo. Separado do passo 2 para que um
 * retry do Inngest depois daqui NÃO pague o modelo de novo (`step.run`
 * memoriza o retorno).
 */
export async function desenharGeracao(generationId: string): Promise<{
  desenho: OfertaDesenhada;
  modelo: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const geracao = await prisma.promotionalOfferGeneration.update({
    where: { id: generationId },
    data: { status: "GENERATING" },
  });
  const entrada = geracao.input as unknown as EntradaDaGeracao;
  const candidatos = candidatosDeTexto(geracao.nivel);
  if (candidatos.length === 0) {
    throw new Error("IA indisponível: sem chave da OpenAI nem do Google");
  }

  const produtos = await resolvePromotionalProducts(geracao.organizationId, {
    manuallyAddedIds: entrada.pedido.produtoIds,
  });
  const precos = entrada.pedido.precosPor ?? {};
  const linhas = entrada.pedido.produtoIds
    .map((id) => produtos.find((p) => p.id === id))
    .filter((p) => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      categoryName: p.categoryName,
      de: p.salePrice,
      por: precos[p.id] ?? p.promotionalPrice,
    }));

  const prompt = montarPrompt(entrada, linhas);
  let ultimaFalha: unknown = null;
  for (const candidato of candidatos) {
    try {
      const resposta = await generateText({
        model: candidato.modelo,
        system: INSTRUCOES,
        prompt,
        output: Output.object({ schema: ofertaDesenhadaSchema }),
        temperature: 0.7,
      });
      // `modelo` é o que DE FATO respondeu — é por ele que se cobra.
      return {
        desenho: resposta.output,
        modelo: candidato.id,
        tokensIn: resposta.usage.inputTokens ?? 0,
        tokensOut: resposta.usage.outputTokens ?? 0,
      };
    } catch (falha) {
      ultimaFalha = falha;
      console.warn(
        `[oferta] ${candidato.id} falhou, tentando o próximo`,
        falha,
      );
    }
  }
  throw ultimaFalha instanceof Error
    ? ultimaFalha
    : new Error("Nenhum modelo conseguiu desenhar a oferta");
}

export type ArteGerada = { chave: string; estrelas: number } | null;

/**
 * A etiqueta salva do pedido, conferida contra a organização: só as dela
 * (`USER`) ou as do sistema. Id de etiqueta de outra org vira "automática".
 */
export async function etiquetaDoPedido(
  organizationId: string,
  pedido: PedidoDeOferta,
): Promise<{ layout: CardLayoutElement[]; proporcao: number } | undefined> {
  if (!pedido.etiquetaId) return undefined;
  const salva = await prisma.promotionalPriceStyle.findFirst({
    where: {
      id: pedido.etiquetaId,
      OR: [{ scope: "USER", organizationId }, { scope: "SYSTEM" }],
    },
    select: { style: true },
  });
  const layout = (salva?.style as { cardLayout?: CardLayoutElement[] } | null)
    ?.cardLayout;
  if (!Array.isArray(layout) || layout.length === 0) return undefined;
  return {
    layout,
    // A do catálogo aberto, ou a do card padrão — em que as etiquetas da
    // biblioteca costumam ser desenhadas.
    proporcao: pedido.proporcaoCard ?? PROPORCAO_DO_CARD_PADRAO,
  };
}

/**
 * Passo 2 (só com `arteIa`): a arte premium da página. Usa o clima e a cor
 * JÁ decididos pela IA no passo 1, para arte e etiquetas combinarem. Passo
 * próprio porque é a parte cara e lenta (~1 min no Premium): um retry depois
 * dela não paga a imagem de novo.
 */
export async function gerarArteDaGeracao(
  generationId: string,
  feito: Awaited<ReturnType<typeof desenharGeracao>>,
): Promise<ArteGerada> {
  const geracao = await prisma.promotionalOfferGeneration.findUniqueOrThrow({
    where: { id: generationId },
  });
  const entrada = geracao.input as unknown as EntradaDaGeracao;
  if (!entrada.pedido.arteIa) return null;
  const final = aplicarDesenho(
    entrada.pedido,
    feito.desenho,
    entrada.estiloLivre,
  );
  return gerarArteDaOferta({
    organizationId: geracao.organizationId,
    nivel: geracao.nivel,
    formato: final.formato,
    nome: entrada.nome,
    clima: final.clima,
    corBase: final.corBase,
    temLogo: !!final.logo,
  });
}

/**
 * Passo 3: compõe, cria o catálogo (quando é um novo), cobra e registra.
 * Num retry, o catálogo não é criado de novo (o id fica gravado na linha
 * antes da cobrança) e só se cobra enquanto `starsCobradas` for zero. Resta
 * uma janela: cobrança feita e a gravação de `starsCobradas` falhando — aí o
 * retry cobraria outra vez. É o mesmo risco do resto do motor de ★.
 */
export async function concluirGeracao(
  generationId: string,
  feito: Awaited<ReturnType<typeof desenharGeracao>>,
  arte: ArteGerada = null,
): Promise<ResultadoDaGeracao> {
  const geracao = await prisma.promotionalOfferGeneration.findUniqueOrThrow({
    where: { id: generationId },
  });
  const entrada = geracao.input as unknown as EntradaDaGeracao;
  const etiqueta = await etiquetaDoPedido(
    geracao.organizationId,
    entrada.pedido,
  );
  const final = {
    ...aplicarDesenho(entrada.pedido, feito.desenho, entrada.estiloLivre),
    ...(arte ? { arte: arte.chave } : {}),
    ...(etiqueta ? { etiqueta } : {}),
  };
  const anterior = (geracao.resultado ?? null) as ResultadoDaGeracao | null;

  let catalogoCriado = anterior?.catalogoCriado;
  if (!geracao.catalogId && !catalogoCriado) {
    const config = catalogoDaOferta(DEFAULT_CONFIG, comporOferta(final));
    const criado = await prisma.promotionalCatalog.create({
      data: {
        organizationId: geracao.organizationId,
        createdById: geracao.userId,
        name: entrada.nome,
        config: config as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    catalogoCriado = criado.id;
  }

  const resultado: ResultadoDaGeracao = {
    entrada: final,
    desenho: feito.desenho,
    ...(catalogoCriado ? { catalogoCriado } : {}),
  };
  await prisma.promotionalOfferGeneration.update({
    where: { id: generationId },
    data: {
      resultado: resultado as unknown as Prisma.InputJsonValue,
      modelo: feito.modelo,
      tokensIn: feito.tokensIn,
      tokensOut: feito.tokensOut,
    },
  });

  // Cobra só uma vez, e só depois de a oferta existir. `cobrarAteOSaldo`
  // porque o serviço já foi prestado: sem saldo, cobra o que houver — o
  // pré-check da procedure é quem segura o gasto.
  let cobradas = emEstrelas(geracao.starsCobradas);
  if (cobradas <= 0) {
    const valor =
      (await precoDaGeracao(
        geracao.organizationId,
        feito.modelo,
        feito.tokensIn,
        feito.tokensOut,
      )) + (arte?.estrelas ?? 0);
    if (valor > 0) {
      const debito = await cobrarAteOSaldo({
        organizationId: geracao.organizationId,
        actionKey: ACOES.astroOferta,
        valor,
        descricao: `Gerador de oferta — "${entrada.nome}" (${feito.modelo}${arte ? " + arte" : ""})`,
        userId: geracao.userId,
      });
      cobradas = debito.valor;
    }
  }

  await prisma.promotionalOfferGeneration.update({
    where: { id: generationId },
    data: { status: "DONE", starsCobradas: cobradas, erro: null },
  });

  await prisma.astroAcao
    .create({
      data: {
        organizationId: geracao.organizationId,
        userId: geracao.userId,
        tool: "gerarOfertaComIA",
        entrada: entrada as unknown as Prisma.InputJsonValue,
        resultado: resultado as unknown as Prisma.InputJsonValue,
        starsCobradas: cobradas,
      },
    })
    .catch((falha) => {
      console.error("[oferta] falha ao registrar a ação", falha);
    });

  return resultado;
}

export async function falharGeracao(
  generationId: string,
  erro: string,
): Promise<void> {
  await prisma.promotionalOfferGeneration
    .update({
      where: { id: generationId },
      data: { status: "FAILED", erro: erro.slice(0, 500) },
    })
    .catch(() => {});
}

/**
 * Geração síncrona, para quem não pode esperar o Inngest — o Astro na
 * conversa precisa devolver o link na mesma resposta. Mesma linha em
 * `PromotionalOfferGeneration`, mesmos dois passos e mesma cobrança da fila.
 * Sem `catalogId`: a oferta vira sempre um catálogo novo.
 */
export async function gerarOfertaAgora(entrada: {
  organizationId: string;
  userId: string;
  nivel: NivelOferta;
  estimadas: number;
  dados: EntradaDaGeracao;
}): Promise<{ catalogoId: string; starsCobradas: number }> {
  const geracao = await prisma.promotionalOfferGeneration.create({
    data: {
      organizationId: entrada.organizationId,
      userId: entrada.userId,
      nivel: entrada.nivel,
      input: entrada.dados as unknown as Prisma.InputJsonValue,
      starsEstimadas: entrada.estimadas,
    },
    select: { id: true },
  });
  try {
    const resultado = await executarGeracao(geracao.id);
    const final = await prisma.promotionalOfferGeneration.findUniqueOrThrow({
      where: { id: geracao.id },
      select: { starsCobradas: true },
    });
    if (!resultado.catalogoCriado) throw new Error("A oferta não foi criada");
    return {
      catalogoId: resultado.catalogoCriado,
      starsCobradas: emEstrelas(final.starsCobradas),
    };
  } catch (falha) {
    await falharGeracao(
      geracao.id,
      falha instanceof Error ? falha.message : "Falha ao gerar",
    );
    throw falha;
  }
}

/** Os três passos em sequência, fora do Inngest (inline e Astro). */
export async function executarGeracao(
  generationId: string,
): Promise<ResultadoDaGeracao> {
  const feito = await desenharGeracao(generationId);
  const arte = await gerarArteDaGeracao(generationId, feito);
  return concluirGeracao(generationId, feito, arte);
}
