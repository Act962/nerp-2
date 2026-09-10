import "server-only";

import { PLANO_GRATIS } from "@/features/billing/lib/planos";
import { creditar } from "@/features/stars/server/debitar";
import { ensureTradeCatalogs } from "@/features/trade-catalog/lib/ensure-catalogs";
import prisma from "@/lib/db";
import { SEGMENT_DEFAULT_DISABLED } from "@/lib/org-segment";
import { enqueueSyncOutbox } from "@/lib/sync-outbox";
import { nichoPorId } from "../lib/nichos";
import { RESPOSTAS_VAZIAS, type RespostasDoWizard } from "../lib/respostas";
import { seedDemoDataForOrg } from "./seed-demo";
import { seedSolucoesDemo } from "./seed-solucoes";

/**
 * Tudo o que uma organização recebe ao nascer — o corpo que antes vivia no
 * `afterCreateOrganization` do Better Auth, agora num lugar só, porque há
 * dois caminhos de nascimento: o formulário (conta de verdade) e o "Começar
 * agora" (sandbox anônima).
 *
 * Nada aqui usa IA. É semente fixa: kanban da cozinha, catálogos de trade,
 * tabelas de preço, configurações do catálogo, 50 ★ de boas-vindas, dados de
 * exemplo por nicho e por solução.
 *
 * A sandbox nasce SEM subdomínio e SEM replicação no NASA: vitrine pública e
 * espelho no ERP só depois que o dono vincular uma conta de verdade
 * (`vincularContaAnonima`).
 */
export async function inicializarOrganizacao(input: {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    metadata?: unknown;
    createdAt: Date | string;
  };
  member?: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date | string;
  } | null;
  user: { id: string; isAnonymous?: boolean | null };
  respostas?: RespostasDoWizard;
}): Promise<void> {
  const { organization, member, user } = input;
  const respostas = input.respostas ?? RESPOSTAS_VAZIAS;
  const sandbox = user.isAnonymous === true;
  const nicho = nichoPorId(respostas.nicho);
  const segment = respostas.segment ?? nicho?.segment ?? null;
  const agora = new Date();

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subdomain: sandbox ? null : organization.slug,
      verifiedAt: sandbox ? null : agora,
      lastAccessAt: agora,
      niche: nicho?.id ?? null,
      interests: respostas.interesses,
      ...(segment
        ? { segment, disabledModules: SEGMENT_DEFAULT_DISABLED[segment] }
        : {}),
    },
  });

  // Semeia o kanban da cozinha estilo iFood (3 colunas padrão editáveis).
  await prisma.kitchenColumn.createMany({
    data: [
      {
        organizationId: organization.id,
        name: "Em Preparo",
        color: "#F97316",
        position: 0,
        isInitial: true,
        icon: "ChefHat",
      },
      {
        organizationId: organization.id,
        name: "Prontos",
        color: "#22C55E",
        position: 1,
        showOnTv: true,
        icon: "BellRing",
      },
      {
        organizationId: organization.id,
        name: "Entregues",
        color: "#64748B",
        position: 2,
        isFinal: true,
        icon: "CheckCheck",
      },
    ],
    skipDuplicates: true,
  });

  // Semeia os catálogos padrão do Trade (mídia, negociação, setores).
  await ensureTradeCatalogs(organization.id);

  // Semeia as 3 tabelas de preço padrão (Varejo=default, Atacado, Revendedor).
  await prisma.priceList.createMany({
    data: [
      {
        organizationId: organization.id,
        name: "Varejo",
        slug: "varejo",
        isDefault: true,
      },
      {
        organizationId: organization.id,
        name: "Atacado",
        slug: "atacado",
        isDefault: false,
      },
      {
        organizationId: organization.id,
        name: "Revendedor",
        slug: "revendedor",
        isDefault: false,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.catalogSettings.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, metaTitle: organization.name },
    update: {},
  });

  // O plano é o Grátis (`billing/lib/planos.ts`), sem linha no banco. O que a
  // org recebe de fato são as ★ de boas-vindas — o extrato registra de onde vieram.
  await creditar({
    organizationId: organization.id,
    valor: PLANO_GRATIS.starsBoasVindas,
    tipo: "WELCOME_BONUS",
    descricao: `Boas-vindas: ${PLANO_GRATIS.starsBoasVindas} ★ para conhecer o Astro`,
    userId: user.id,
  });

  // Dados de exemplo em `try/catch`: são conveniência, e uma org sem exemplo
  // é infinitamente melhor que uma org que não nasce.
  try {
    await seedDemoDataForOrg(
      organization.id,
      user.id,
      prisma,
      nicho?.pacote ?? "mercearia",
    );
    if (member?.id) {
      await seedSolucoesDemo({
        organizationId: organization.id,
        userId: user.id,
        memberId: member.id,
      });
    }
  } catch (erro) {
    console.error("[onboarding] seed de dados de exemplo falhou", erro);
  }

  // A sandbox não é replicada no NASA: uma conta que pode sumir em 30 dias
  // não vira cadastro em outro sistema. `vincularContaAnonima` replica depois.
  if (sandbox) return;

  await enqueueSyncOutbox("org", {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo ?? null,
    metadata:
      typeof organization.metadata === "string"
        ? organization.metadata
        : organization.metadata
          ? JSON.stringify(organization.metadata)
          : null,
    createdAt: new Date(organization.createdAt).toISOString(),
  });
  if (member?.id) {
    await enqueueSyncOutbox("member", {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: new Date(member.createdAt).toISOString(),
    });
  }
}
