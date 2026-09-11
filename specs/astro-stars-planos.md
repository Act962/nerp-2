# Astro no nerp + Stars por token + plano Grátis com limites

> O Astro (consultor do site) entra no ERP como assistente da operação, cobrado em ★ por token; a organização nova nasce no plano Grátis com 50 ★, dados de exemplo e limites de cadastro; o saldo fica visível na sidebar o tempo todo.
> Feature: `packages/astro-widget` + `src/features/{astro,stars,billing,onboarding}` + `src/app/router/{stars,onboarding}` + `src/app/api/astro/chat` + `src/app/(main)/(rest)/configuracoes/{stars,planos}`
> Branch: `feat/astro-stars-planos` (a partir de `origin/main`)
> Criado em: 2026-09-10 · Atualizado em: 2026-09-10
> Status: 🟡 Em andamento — código pronto, aguardando teste do dev
> Continuação: esta spec é a **base** do épico "Astro operacional". As seis fases seguintes estão mapeadas em [`astro-operacional.md`](./astro-operacional.md); o que o Astro passou a cobrar (catálogo, campanha, imagem gerada, busca na web) foi acrescentado em `acoes-chaves.ts` pelas fases 3 e 4, com preço padrão junto.

---

## Situacao atual

Antes desta branch, o Astro existia só no site institucional (`features/astro-consultor`, Gemini Flash, sem dado de inquilino) e o `prompt.ts` previa um canal `"app"` que nunca foi construído. As Stars existiam como ledger do WhatsApp (`features/stars`): saldo, débito atômico, extrato, recarga pelo Stripe. Não havia noção de limite/percentual/uso extra, nem plano Grátis, nem limite de cadastro, nem indicador visível fora de `/whatsapp/creditos`.

Arquivos principais:
- `src/features/billing/lib/planos.ts` — **catálogo de planos hard-coded** (Grátis + três slots pagos a preencher), no formato do `@better-auth/stripe`.
- `src/features/billing/server/plano-da-organizacao.ts` — resolve o plano: assinatura → legado → grátis. É o único ponto que decide plano.
- `src/features/billing/server/limites.ts` — `assertDentroDoLimite`, `vagasRestantes`, `LimiteDoPlanoError`.
- `src/features/stars/lib/uso.ts` — `calcularUso` (percentual, uso extra, nível) e `custoDeTokens`.
- `src/features/stars/server/debitar.ts` — `cobrarValor`, `cobrarAteOSaldo`, preço padrão do Astro; `credito-do-ciclo.ts` lê o catálogo novo e zera o consumido na virada.
- `src/features/astro/server/{tools-app,cobranca}.ts` + `src/app/api/astro/chat/route.ts` — o canal logado.
- `src/features/onboarding/server/{seed-demo,remover-demo}.ts` — dados de exemplo (`isDemo`).
- `prisma/schema.prisma` — `Organization.starsUsedInCycle`, `isDemo` em Product/Customer/Supplier/Store/Category/PromotionalCatalog.

---

## O que foi feito

### Planos (hard-coded, sem banco)
- [x] `PLANOS` com `PLANO_GRATIS` (50 ★ de boas-vindas, limites 10 produtos / 10 clientes / 5 fornecedores / 1 loja / 2 membros) e `plano-1|2|3` como slots — nome, preço, `priceId` e limites **a preencher**.
- [x] `PLANO_LEGADO`: org criada antes de `LIMITES_A_PARTIR_DE` (constante em `plano-da-organizacao.ts`, 2026-09-10) não tem limite nem ★ de plano. **Ajustar a data para a do deploy.**
- [x] `planosParaBetterAuth()` devolve só planos com `priceId`, no formato `subscription.plans`.
- [x] `/configuracoes/planos` lista o catálogo; slot sem `priceId` aparece "Em breve".
- [x] `starsPerMonth` saiu de `PlanQuotas` (trade): ★ por ciclo mora só no catálogo novo.

### Stars
- [x] `starsUsedInCycle` incrementa em todo débito e zera quando o ciclo vira.
- [x] `stars.balance` devolve `plano`, `limite`, `consumido`, `percentual`, `usoExtra`, `nivel` e `precos.astroPor1k`; confere o crédito do ciclo ao ler.
- [x] Preço padrão do Astro (`PRECOS_PADRAO`, 1 ★ / 1.000 tokens) — nasce ligado; `StarRule` sobrepõe, inclusive com zero. WhatsApp continua desligado por padrão.
- [x] `cobrarValor` (valor explícito) e `cobrarAteOSaldo` (`FOR UPDATE`, clampa ao saldo, nunca negativo, registra parcial).
- [x] Painel na sidebar (`painel-sidebar.tsx`): estrela colorida por nível (ok / laranja / vermelho), barra de uso, "+N ★ além do plano", botão de compra ao zerar. Colapsado: só a estrela com tooltip.
- [x] `/configuracoes/stars` (saldo, uso do plano, extrato, compra); `/whatsapp/creditos` redireciona. Comprar e definir preço só admin.

### Limites de cadastro
- [x] `assertDentroDoLimite` em `createProductForOrg` (cobre create, import e erp-sync), `products.duplicate` (que também ganhou escopo por org — era IDOR), `customer.create`, `supplier.create`, `store.create`, `invitation.create`, `joinLink.accept`, e pré-flight nos quatro `import.create`. Runners de importação param na primeira linha sem vaga.
- [x] `isDemo` não conta. Membros = membros + convites pendentes.
- [x] Cliente: `avisarErro` nos hooks de criação/importação abre `<LimiteDoPlanoDialog>` (montado no `ModalProvider`) com CTA "Ver planos".

### Astro no app — o mesmo widget do site
- [x] **`packages/astro-widget` (`@nerp/astro-widget`)**: o widget do site (`AstroWidget`, `AstroMark`, CSS) saiu de `apps/site/src/features/astro` para um pacote, parametrizado por props (`api`, `ativo`, `produto`, `precos`, `whatsappHref`, `baseDosLinks`, `linksEmNovaAba`, `abertura`, `sugestoes`, `nota`, `aoFalhar`, `onResposta`) e com `abrirAstro()` para abrir o painel por evento. O site passou a montar o pacote por um wrapper fino (`apps/site/src/features/astro/astro-widget.tsx`). Nenhum app importa do outro.
- [x] No nerp, `<AstroFlutuante>` monta o widget no leiaute logado (`(main)/layout.tsx`), flutuando em toda página, com os cartões de solução apontando para o site (`NEXT_PUBLIC_SITE_URL`, padrão `https://orbitatec.com.br`) em aba nova. Um 402 vira o botão "Comprar Stars". Assets do mascote copiados para `apps/web/public/orbita/`.
- [x] **Mesma inteligência do site**: o canal `app` usa a persona, as regras, o índice de ferramentas, segmentos e método do site, e TODAS as tools do site (busca, detalhe, segmento, método, estimativa de preço, formulário, diagnóstico) mais as da operação (`minhaOperacao`, `modulosContratados`, `buscarProdutos`, `resumoDeVendas`, `contarCadastros`). O que muda é o roteiro: quem fala já é conhecido (nome/e-mail da sessão vão no prompt e como `visitante`), então não há captura de nome/CNPJ.
- [x] `POST /api/astro/chat`: sessão Better Auth + org ativa + member; `astro-config` e `astro-precos` (mesmas chaves do site); pré-check de saldo → **402**; `SiteChatSession` `channel: APP` escopada por org e usuário; débito no `onFinish`.
- [x] Botão "Falar com o Astro" do card de boas-vindas abre o widget (`abrirAstro()`). Não há mais página `/astro` nem item no menu: a entrada é o mascote flutuante, como no site.

### Menu por interesse
- [x] Sidebar reorganizada em `app-sidebar.tsx`: **Dashboard** (só o meu), **ERP** (antigo "Frente de caixa" + Produtos, Estoque e Catálogo Online), Financeiro, Clientes, Fornecedores, **Calendário de Ações**, **Mais Soluções** (antigo "Apps", em destaque: Books de PDV — cujo sub-item "Books" abre `/books?aba=books`, a aba ao lado de "Aprovação de fotos", agora controlada pela URL via nuqs —, Trade Marketing, Catálogo Promocional, Ranking de Equipes, Dashboard API — antes "Dashboard da organização" —, WhatsApp, Pedidos com Colaboradores dentro, App Promotor, App Vendedor, Aplicativos offline), Integrações e Configurações. Os grupos ERP e Mais Soluções não têm permissão própria: cada filho decide, senão quem tem só "produtos" perderia o menu por não ter "vendas".

### Onboarding
- [x] `afterCreateOrganization`: `CatalogSettings` (saiu do client), 50 ★ `WELCOME_BONUS`, `seedDemoDataForOrg` em `try/catch`.
- [x] Seed: 3 categorias, 10 produtos com foto (`public/exemplo/*.jpg`), 3 fornecedores com logo, 5 clientes, 1 loja, 1 catálogo promocional com fundo. Idempotente.
- [x] `onboarding.status` / `onboarding.removerDadosDeExemplo` (admin; o que já tem movimento só perde a marca).
- [x] Card de boas-vindas no dashboard; org nova cai em `/dashboard`.

---

## Pendencias

### Critico
- [ ] **Data de corte** (`LIMITES_A_PARTIR_DE`) — trocar para a data/hora do deploy em produção antes de mesclar; org criada entre a data e o deploy viraria Grátis.
- [ ] **Migration** `20260910120000_stars_uso_e_dados_demo` — `pnpm db:deploy` antes do build (o `nixpacks.toml` já faz). Sem ela, `stars.balance` 500 ao selecionar `stars_used_in_cycle`.

### Funcional
- [ ] **Preencher os planos pagos** em `planos.ts`: nome, descrição, preço, `priceId` (mensal) e `annualDiscountPriceId`, limites e `starsPorCiclo`.
- [ ] **Plugar `@better-auth/stripe`** (João): `stripe({ stripeClient, stripeWebhookSecret, subscription: { enabled: true, plans: planosParaBetterAuth(), authorizeReference } , organization: { enabled: true } })` em `lib/auth.ts`; depois, em `planoDaOrganizacao`, ler `subscription` (`referenceId = organizationId`, `status in active|trialing`) antes das regras de legado/grátis. O botão "Escolher" em `planos.tsx` chama `authClient.subscription.upgrade({ plan, referenceId, customerType: "organization" })`.
- [ ] Badge "Exemplo" nas listagens de produtos/clientes/fornecedores.
- [ ] **Preços das ações novas** — `astro_catalogo` e `astro_campanha` (5 ★), `astro_imagem_gerada` (5 ★) e `astro_busca_web` (1 ★) entraram com preço padrão em `PRECOS_PADRAO`. Conferir se os valores fazem sentido junto com o preço por mil tokens antes de abrir para clientes; `StarRule` continua mandando quando existir.

### Qualidade de codigo
- [ ] `create-form-org.tsx` ainda faz `checkSlug` + `create` + `setActive` + `updateProfile` em sequência no cliente; o resto do onboarding já está no servidor.

---

## Decisoes tomadas

- **Planos em código, não no banco** (dev) — mudar preço/limite/nome é editar `planos.ts`. Nenhum enum novo, nenhum backfill. O formato é o do `@better-auth/stripe`, que vai vender a assinatura por organização.
- **Orgs existentes = legado por data de corte**, não por coluna — é a única forma de não mexer no banco e ainda não dar limite de 10 produtos a quem já usa.
- **Uso extra = ★ avulsas, nunca saldo negativo** (dev) — passou do plano, desconta das compradas; zerou, bloqueia e oferece compra. Sem cobrança pós-paga.
- **Nível pelo saldo, não pelo consumido** — quem comprou 450 ★ não fica vermelho por ter gasto as 50 do plano.
- **Astro nasce cobrado; WhatsApp continua desligado** — o Astro gasta token de LLM em toda resposta; sem preço padrão seria conta de API aberta.
- **Cobrança do Astro no fim do stream, clampada ao saldo** — tokens só existem no `onFinish`; o pré-check de um bloco é o que segura o gasto.
- **Stars NÃO destravam cadastro** — ★ compram uso do Astro e do WhatsApp; vaga de cadastro é plano. Alternativa rejeitada: "pagar registro com ★" exigiria contabilidade por recurso.
- **Assinatura de plano no Stripe fica fora desta branch** (dev) — o João configura; só a recarga avulsa (que já existia) está ativa.
- **Dados de exemplo automáticos com `isDemo`** (dev) — não contam no limite e saem com um clique.
- **`products.duplicate` ganhou `requireOrgMiddleware` e escopo por org** — era um IDOR (duplicava produto de qualquer org por id) e o limite precisava do `context.org`.

---

## Antes do merge e do deploy

1. `pnpm db:deploy` (uma migration, só `ADD COLUMN IF NOT EXISTS`).
2. `pnpm db:generate` já está coberto pelo build; `SCHEMA_VERSION` = `v89-astro-stars-planos`.
3. Dependências novas: `@ai-sdk/react` e `@nerp/astro-widget` (workspace) em `apps/web`; `@nerp/astro-widget` em `apps/site`; ambos com `transpilePackages`.
4. Envs: nenhuma nova. O Astro no app usa as mesmas do site (`GOOGLE_GENERATIVE_AI_API_KEY` ou `OPENAI_API_KEY`, `astro-config` em `SiteSetting`); a recarga usa `STRIPE_SECRET_KEY` + `STRIPE_STARS_WEBHOOK_SECRET`.
5. Conferir `LIMITES_A_PARTIR_DE`.

---

## Testes

- unit: `stars/lib/uso.test.ts`, `billing/lib/planos.test.ts`, `billing/server/plano-da-organizacao.test.ts`, `astro-consultor/server/prompt.test.ts` (escopo `app`).
- integração: `tests/integration/stars.test.ts` (+ `cobrarValor`, `cobrarAteOSaldo`, `starsUsedInCycle`, preço padrão do Astro), `stars-recarga.test.ts` (crédito do ciclo pelo catálogo, consumido zera), `limites-do-plano.test.ts`, `onboarding-seed.test.ts`, `astro-app.test.ts`.

---

## Melhorias futuras (nao urgentes)

- [ ] Tools de escrita com confirmação ("cadastra esse produto para mim").
- [ ] Histórico de conversas do Astro por usuário.
- [ ] Alerta por e-mail quando as ★ chegarem ao nível crítico.
