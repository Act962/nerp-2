import "server-only";

import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  ASTRO_CONFIG_KEY,
  googleDisponivel,
  lerConfig,
  openaiDisponivel,
} from "@/features/astro-consultor/server/provider";
import {
  COTA_DIARIA_DE_IMAGENS,
  gerarImagemComFallback,
} from "@/features/astro/server/gerar-imagem";
import { custoDaImagem } from "@/features/astro/server/modelos";
import { inicioDoDiaNaLoja, STORE_TZ } from "@/features/sales/lib/period-range";
import { arredondarEstrelas, emEstrelas } from "@/features/stars/lib/decimal";
import { ACOES, cobrarAteOSaldo } from "@/features/stars/server/debitar";
import { CLIMAS_OFERTA, type ClimaOferta } from "../lib/compor-oferta";
import { IMAGEM_DO_NIVEL, type NivelOferta } from "../lib/oferta-desenhada";

export function logoDisponivel(): boolean {
  return !!openaiDisponivel() || !!googleDisponivel();
}

/** ★ de um logo no nível. `StarRule` de `astro_oferta_logo` manda, se houver. */
export async function precoDoLogo(
  organizationId: string,
  nivel: NivelOferta,
): Promise<number> {
  const regra = await prisma.starRule.findUnique({
    where: {
      organizationId_actionKey: {
        organizationId,
        actionKey: ACOES.astroOfertaLogo,
      },
    },
    select: { stars: true, isActive: true },
  });
  if (regra) return regra.isActive ? Math.max(0, emEstrelas(regra.stars)) : 0;
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  const config = lerConfig(linha?.value);
  return arredondarEstrelas(
    custoDaImagem({
      ...IMAGEM_DO_NIVEL[nivel],
      base: { dolar: config.dolar, realPorEstrela: config.realPorEstrela },
    }).estrelas,
  );
}

export function promptDoLogo(entrada: {
  nome: string;
  clima: ClimaOferta;
  corBase?: string;
  loja?: string;
  instrucoes?: string;
}): string {
  const clima = CLIMAS_OFERTA.find((c) => c.value === entrada.clima)?.label;
  return [
    `Logotipo de campanha de ofertas de varejo com o texto exato "${entrada.nome}".`,
    entrada.loja ? `A campanha é da loja ${entrada.loja}.` : "",
    `Estilo: ${clima ?? "impacto varejo"}, lettering chamativo de encarte brasileiro, composição horizontal.`,
    entrada.corBase
      ? `Cor principal ${entrada.corBase}, com contorno e sombra para ler sobre fundo claro ou escuro.`
      : "",
    "Letras grandes e 100% legíveis, sem erros de grafia, sem outros textos, sem mockup, sem moldura, fundo transparente.",
    entrada.instrucoes ? `Pedido do cliente: ${entrada.instrucoes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Gera o logo, guarda no R2 e na biblioteca de etiquetas (`CatalogAsset`),
 * cobra e registra. A cota diária é a mesma das imagens do Astro.
 */
export async function gerarLogoDaOferta(entrada: {
  organizationId: string;
  userId: string;
  nivel: NivelOferta;
  nome: string;
  clima: ClimaOferta;
  corBase?: string;
  instrucoes?: string;
}): Promise<{ chave: string; url: string; starsCobradas: number }> {
  const usadasHoje = await prisma.astroAcao.count({
    where: {
      organizationId: entrada.organizationId,
      tool: { in: ["gerarImagem", "gerarLogoDeOferta"] },
      erro: null,
      createdAt: { gte: inicioDoDiaNaLoja(new Date(), STORE_TZ) },
    },
  });
  if (usadasHoje >= COTA_DIARIA_DE_IMAGENS) {
    throw new Error(
      `A organização já gerou ${COTA_DIARIA_DE_IMAGENS} imagens hoje — o limite volta amanhã.`,
    );
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: entrada.organizationId },
    select: { name: true },
  });
  const { modelo, qualidade } = IMAGEM_DO_NIVEL[entrada.nivel];
  const imagem = await gerarImagemComFallback({
    organizationId: entrada.organizationId,
    descricao: promptDoLogo({ ...entrada, loja: org.name }),
    modelo,
    qualidade,
    proporcao: "3:2",
    transparente: true,
    pasta: "catalogo/logos",
  });

  await prisma.catalogAsset.create({
    data: {
      organizationId: entrada.organizationId,
      name: `Logo — ${entrada.nome}`.slice(0, 120),
      key: imagem.chave,
      createdById: entrada.userId,
    },
  });

  // Depois da imagem existir: sem saldo, cobra o que houver (o pré-check da
  // procedure é quem segura).
  let starsCobradas = 0;
  const valor = await precoDoLogo(entrada.organizationId, entrada.nivel);
  if (valor > 0) {
    const debito = await cobrarAteOSaldo({
      organizationId: entrada.organizationId,
      actionKey: ACOES.astroOfertaLogo,
      valor,
      descricao: `Gerador de oferta — logo "${entrada.nome}" (${modelo})`,
      userId: entrada.userId,
    });
    starsCobradas = debito.valor;
  }

  await prisma.astroAcao
    .create({
      data: {
        organizationId: entrada.organizationId,
        userId: entrada.userId,
        tool: "gerarLogoDeOferta",
        entrada: entrada as unknown as Prisma.InputJsonValue,
        resultado: { chave: imagem.chave } as Prisma.InputJsonValue,
        starsCobradas,
      },
    })
    .catch((falha) =>
      console.error("[oferta] falha ao registrar o logo", falha),
    );

  return { chave: imagem.chave, url: imagem.url, starsCobradas };
}
