# Sandbox — Fase 0: fechar brechas que a entrada anônima amplifica

> Antes de qualquer pessoa criar conta em um clique, as portas que hoje dependem de "só quem tem conta" precisam de dono, teto e escopo. Fase 0 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/lib/auth.ts` + `src/lib/s2s-scopes.ts` + `src/app/middlewares/auth.ts` + `src/app/router/org/{update,check}-subdomain.ts` + `src/app/api/s3/{upload,delete}` + `src/features/uploads/server/*` + `src/features/organization/lib/subdominio.ts`
> Branch: `feat/sandbox-fase-0-brechas` (a partir de `origin/main`)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Quatro brechas pré-existentes ficam baratas de explorar quando a conta é grátis e sem identidade:

- **Organizações sem limite por conta** (`organizationLimit` não configurado): cada org nasce com dados de exemplo, 50 ★ e subdomínio público.
- **Rate limit do Better Auth em memória** (padrão): por processo, inútil com mais de uma instância no Coolify, e desligado fora de produção.
- **`org.updateSubdomain` sem checagem de papel nem nome reservado**: qualquer membro trocava o subdomínio; `api`, `login`, `nerp` eram registráveis e o `middleware.ts` reescreve qualquer subdomínio para a vitrine.
- **Bucket do R2 sem dono**: `/api/s3/upload` assinava para qualquer sessão, sem cota; `/api/s3/delete` apagava **qualquer chave** do bucket com qualquer sessão (vazamento entre inquilinos).
- **Chave S2S valia como o login inteiro**: só duas procedures exigiam escopo; `s2sScopes` era decorativo para as outras 55 entidades.

---

## O que foi feito

- [x] **Rate limit no banco** — `rateLimit: { storage: "database", enabled: true, window 60 / max 100 }` com regras por rota (`/sign-in/*` 10/min, `/sign-in/anonymous` e `/sign-up/email` e `/organization/create` 5/h, `/get-session` livre) e `advanced.ipAddress.ipAddressHeaders` para o proxy. Model `RateLimit` (`lastRequest Float` — o Better Auth faz aritmética em número; `BigInt` do Prisma estouraria "Cannot mix BigInt").
- [x] **`organizationLimit`**: até 5 organizações como owner por conta (a Fase 1 reduz para 1 quando `isAnonymous`).
- [x] **Subdomínio**: `validarSubdominio` (`features/organization/lib/subdominio.ts`, neutro) com reservados e formato de rótulo DNS; `updateSubdomain` exige `isOrgAdmin`; `checkSubdomain` usa a mesma régua.
- [x] **R2 com dono**: chaves novas com prefixo `<orgId>/`; presign exige organização ativa e reserva cota diária (`UploadQuotaDaily`, 200 MB/dia, `updateMany` condicionado); `delete` só apaga chave com o prefixo da org ou, para chaves antigas sem prefixo, chave referenciada por uma linha da org (`chavePertenceAOrg`).
- [x] **S2S fail-closed**: `s2s-scopes.ts` no molde de `device-scopes.ts`; `requireAuthMiddleware` recusa chave sem escopo para o path; escopo `*` = acesso total (suíte de testes e consentimento explícito).

---

## Pendencias

### Critico
- [ ] **Migration** `20260911120000_fase0_rate_limit_e_cota_upload` — `pnpm db:deploy` antes do build. `SCHEMA_VERSION = v89-fase0-rate-limit-cota-upload`.
- [ ] **Escopos que a Órbita/NASA pede hoje** — o mapa só conhece `pdv:read`. Se a integração chamar outra procedure, ela passa a receber FORBIDDEN: conferir com o João quais paths a NASA usa e listá-los em `s2s-scopes.ts` antes do deploy.

### Funcional
- [ ] Fechar `/cadastro` por senha para quem não veio de convite (hoje só escondido).
- [ ] Listar e apagar objetos R2 por prefixo `<orgId>/` quando uma org for apagada (Fase 1 usa).

---

## Decisoes tomadas

- **Prefixo por organização na chave do R2**, e não uma tabela de posse: a chave carrega o dono, e a checagem é `startsWith`. Chaves antigas continuam valendo pela referência.
- **Cota reservada no presign**, não no PUT: o servidor nunca vê o PUT (vai direto ao R2); reservar na assinatura é o único ponto de controle.
- **Fail-closed para S2S** com escopo `*` explícito, em vez de espalhar `requireScope` procedure a procedure — procedure nova nasce protegida.
- **Não foi feito nesta fase**: gatear vitrine por conta verificada (precisa de `verifiedAt`, Fase 1).

---

## Testes

- unit: `features/organization/lib/subdominio.test.ts`, `lib/s2s-scopes.test.ts`, `features/uploads/server/cota.test.ts` (dia no fuso da loja).
- integração: `tests/integration/org-subdomain.test.ts`, `s2s-scopes.test.ts`, `upload-quota.test.ts`, `s3-delete-owner.test.ts`.
