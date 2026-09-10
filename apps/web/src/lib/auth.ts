import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ensureTradeCatalogs } from "@/features/trade-catalog/lib/ensure-catalogs";
import prisma from "./db";
import { enqueueSyncOutbox } from "./sync-outbox";
import { crossLoginPlugin } from "./cross-login-plugin";
// If your Prisma file is located elsewhere, you can change the path

// Base host (sem porta) e origin do app. Em dev: "localhost" / http://localhost:3000.
//
// 3000 e não 3001: é a porta em que este app roda (`next dev` sem `-p`, e o
// alvo `nerp` do `.claude/launch.json`). A 3001 é do `apps/site`, e um padrão
// apontando para outro app é pior do que um padrão ausente — sem o `.env` o
// login passaria a confiar na origem do site institucional.
const baseHost = (
  process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000"
).split(":")[0];
const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const scheme = baseUrl.startsWith("https") ? "https" : "http";
const baseOrigin = baseUrl.replace(/\/$/, "");

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  // Aceita requisições do host apex e de subdomínios multi-tenant
  // (ex.: gotham.localhost:3000). Sem isso, Better Auth rejeita requests
  // com origin diferente do BETTER_AUTH_URL.
  // Observação: cookie continua host-only (sem Domain). Compartilhamento
  // entre subdomínios via crossSubDomainCookies foi removido porque alguns
  // browsers (Chrome) rejeitam Domain=.localhost, derrubando a sessão.
  trustedOrigins: [
    baseOrigin,
    `${scheme}://${baseHost}`,
    `${scheme}://*.${baseHost}`,
    // Origins do app desktop (Tauri) — para o login interativo do pareamento
    // funcionar cross-origin. CSV em DESKTOP_ALLOWED_ORIGINS (mesma lista do CORS).
    ...(process.env.DESKTOP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],

  // Limite de requisições no BANCO, não em memória: o padrão do Better Auth
  // guarda o contador no processo, e no Coolify com mais de uma instância cada
  // réplica contaria sozinha — o limite viraria N vezes o configurado. E
  // `enabled: true` porque o padrão só liga em produção, e é em dev que se
  // descobre que ele quebrou algo.
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-in/social": { window: 60, max: 10 },
      "/sign-in/anonymous": { window: 3600, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/organization/create": { window: 3600, max: 5 },
      // A sessão é lida em todo layout; sem esta exceção o teto global
      // derrubaria quem só navega rápido.
      "/get-session": false,
    },
  },

  advanced: {
    // Atrás do proxy do Coolify o IP real chega nestes cabeçalhos — é o mesmo
    // par que `astro-consultor/server/rate-limit.ts` lê. Sem isto, o limite
    // por IP contaria o proxy inteiro como um cliente só.
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 20,
    requireEmailVerification: false,
    // Sem provedor de e-mail configurado neste ambiente, o reset só é útil se o
    // link chegar em algum lugar: fora de produção ele vai pro log do servidor.
    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV === "production") {
        console.error(
          `[auth] Reset de senha solicitado por ${user.email}, mas nenhum provedor de e-mail está configurado.`,
        );
        return;
      }
      console.info(`[auth] Link de reset de senha para ${user.email}: ${url}`);
    },
  },
  // ── Sync de auth NERP → NASA (best-effort) ──────────────────────────
  // Os hooks só GRAVAM na SyncOutbox (fire-and-forget); um processador
  // (endpoint/cron) entrega ao NASA com retry/backoff. Tudo via Prisma cru
  // do lado de lá, então não há eco.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await enqueueSyncOutbox("user", {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image ?? null,
            phone: null,
            createdAt: new Date(user.createdAt).toISOString(),
            updatedAt: new Date(user.updatedAt).toISOString(),
          });
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          await enqueueSyncOutbox("account", {
            id: account.id,
            accountId: account.accountId,
            providerId: account.providerId,
            userId: account.userId,
            accessToken: account.accessToken ?? null,
            refreshToken: account.refreshToken ?? null,
            idToken: account.idToken ?? null,
            accessTokenExpiresAt: account.accessTokenExpiresAt
              ? new Date(account.accessTokenExpiresAt).toISOString()
              : null,
            refreshTokenExpiresAt: account.refreshTokenExpiresAt
              ? new Date(account.refreshTokenExpiresAt).toISOString()
              : null,
            scope: account.scope ?? null,
            password: account.password ?? null,
            createdAt: new Date(account.createdAt).toISOString(),
            updatedAt: new Date(account.updatedAt).toISOString(),
          });
        },
      },
    },
  },
  plugins: [
    organization({
      // O Better Auth barra convite/adição de membro em 100 por organização
      // quando isto não é informado. Enquanto a cobrança por assento não volta,
      // não queremos teto nenhum.
      membershipLimit: 100_000,
      // Sem isto, uma conta cria organizações sem fim — e cada uma nasce com
      // dados de exemplo, ★ de boas-vindas e um subdomínio público. Cinco é
      // folga para quem tem várias lojas; `true` = limite atingido.
      organizationLimit: async (user) => {
        const donoDe = await prisma.member.count({
          where: { userId: user.id, role: "owner" },
        });
        return donoDe >= 5;
      },
      // O envio do convite NÃO fica aqui: o Better Auth executa
      // `sendInvitationEmail` como background task e engole exceções, o que
      // faria um convite sem e-mail parecer sucesso. Quem envia é o handler
      // `router/invitation/create.ts`, que consegue reportar a falha ao admin.
      organizationHooks: {
        afterCreateOrganization: async ({ organization, member }) => {
          await prisma.organization.update({
            where: {
              id: organization.id,
            },
            data: {
              subdomain: organization.slug,
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
          });
          // Semeia os catálogos padrão do Trade (mídia, negociação, setores).
          await ensureTradeCatalogs(organization.id);
          // Semeia as 3 tabelas de preço padrão (Varejo=default, Atacado,
          // Revendedor) — a org já nasce pronta pra vincular clientes por tipo.
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
          // Replica org + member do owner no NASA.
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
        },
        afterAddMember: async ({ member }) => {
          await enqueueSyncOutbox("member", {
            id: member.id,
            organizationId: member.organizationId,
            userId: member.userId,
            role: member.role,
            createdAt: new Date(member.createdAt).toISOString(),
          });
        },
        // `permissions` é campo nosso no Invitation, fora do tipo do plugin —
        // por isso relemos do banco em vez de usar o objeto do hook.
        afterAcceptInvitation: async ({ invitation, member }) => {
          const record = await prisma.invitation.findUnique({
            where: { id: invitation.id },
            select: { permissions: true, tradeRole: true },
          });

          if (record?.permissions.length || record?.tradeRole) {
            await prisma.member.update({
              where: { id: member.id },
              data: {
                ...(record.permissions.length
                  ? { permissions: record.permissions }
                  : {}),
                ...(record.tradeRole ? { tradeRole: record.tradeRole } : {}),
              },
            });
          }
        },
      },
    }),
    crossLoginPlugin(),
  ],
});
