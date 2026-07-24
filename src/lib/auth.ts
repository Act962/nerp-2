import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ensureTradeCatalogs } from "@/features/trade-catalog/lib/ensure-catalogs";
import prisma from "./db";
import { enqueueSyncOutbox } from "./sync-outbox";
import { crossLoginPlugin } from "./cross-login-plugin";
// If your Prisma file is located elsewhere, you can change the path

// Base host (sem porta) e origin do app. Em dev: "localhost" / http://localhost:3001.
const baseHost = (
  process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3001"
).split(":")[0];
const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
const scheme = baseUrl.startsWith("https") ? "https" : "http";
const baseOrigin = baseUrl.replace(/\/$/, "");

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  // Aceita requisições do host apex e de subdomínios multi-tenant
  // (ex.: gotham.localhost:3001). Sem isso, Better Auth rejeita requests
  // com origin diferente do BETTER_AUTH_URL.
  // Observação: cookie continua host-only (sem Domain). Compartilhamento
  // entre subdomínios via crossSubDomainCookies foi removido porque alguns
  // browsers (Chrome) rejeitam Domain=.localhost, derrubando a sessão.
  trustedOrigins: [
    baseOrigin,
    `${scheme}://${baseHost}`,
    `${scheme}://*.${baseHost}`,
  ],

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
            select: { permissions: true },
          });

          if (record?.permissions.length) {
            await prisma.member.update({
              where: { id: member.id },
              data: { permissions: record.permissions },
            });
          }
        },
      },
    }),
    crossLoginPlugin(),
  ],
});
