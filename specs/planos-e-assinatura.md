# Planos: nomes, preços e o que falta para o Stripe

> Os quatro planos saem do "em definição": nomes herdados do NASAEX-WEY, preços ancorados no mercado, e um comparativo na tela mostrando quanto custaria pagar cada ferramenta separada. O gateway fica pronto para o João plugar.
> Feature: `src/features/billing/lib/{planos,comparativo}.ts` + `components/planos.tsx`
> Branch: `feat/planos-nomes-e-precos`
> Criado em: 2026-09-11 · Status: 🟡 Em andamento

---

## Situacao atual

Três dos quatro cards diziam "Plano 1", "Em definição.", botão desligado. Quando as ★ acabavam, o Astro só oferecia comprar avulso — quem batia no fim do saldo toda semana estava pagando mais caro do que precisaria, e não tinha por onde descobrir isso.

---

## Os planos

| plano | mensal | anual | ★ por ciclo | lojas | membros |
|---|---|---|---|---|---|
| **Suit** | Grátis | — | 50 de boas-vindas | 1 | 2 |
| **Earth** | R$ 197 | R$ 1.970 | 800 | 2 | 5 |
| **Explore** | R$ 397 | R$ 3.970 | 1.800 | 5 | 15 |
| **Constellation** | R$ 797 | R$ 7.970 | 4.000 | ilimitadas | ilimitados |

Nomes iguais aos do NASAEX-WEY: quem conhece as duas casas não deve encontrar dois vocabulários para a mesma coisa. O `id` do plano de entrada mudou de `gratis` para `suit` — seguro agora porque nenhuma organização tem assinatura ainda, e o `id` é a chave que vai para `subscription.plan`.

**De onde vêm os preços.** Um ERP de operação real custa entre R$ 189 e R$ 299 por mês — Tiny Multi R$ 189, ContaAzul Plus R$ 219, Omie Avançado R$ 295, Bling Plano 7 R$ 299. Plataforma de WhatsApp com CRM fica entre R$ 99 e R$ 599, mais o que a Meta cobra por conversa. Trade marketing é cotação fechada. Somando o que o nerp entrega numa assinatura só, quem comprasse separado passa de R$ 650 por mês.

**A cota de ★ nunca vale mais que a mensalidade.** A ★ sai por R$ 0,0998 no pacote pequeno, então 800 ★ dentro do Earth são R$ 80 de consumo num plano de R$ 197 — 41%. No Explore são 45%, no Constellation 50%. Há teste travando essa razão: cota generosa demais é prejuízo que só aparece quando a conta do provedor chega. As 20.000 ★ do Constellation do NASAEX-WEY valeriam R$ 2.000 num plano de R$ 797, e por isso não foram copiadas.

**O anual cobra dez meses e entrega doze.** Em código, e não por plano: é política comercial, e um desconto diferente por plano viraria tabela de exceções.

---

## O comparativo

Sai da tabela `astro-precos` (`modulos[{ toolId, minCents, maxCents }]`), a MESMA que o consultor do site usa para estimar, cadastrada em `/site/precos`. Uma segunda tabela em código daria dois preços para a mesma ferramenta, e o dia em que divergissem seria o dia de uma proposta errada.

- `compararComAvulso` é pura e diz **quantas** ferramentas entraram na conta: o catálogo do site não cobre Astro, Financeiro e Pedidos, e dizer "todas" seria mentira.
- `economiaPercentual` calcula sobre o **piso** do avulso, não sobre a média — o desconto anunciado tem de se sustentar no pior caso para nós. Plano mais caro que o avulso devolve `null` e a tela não fala em economia, porque economia que não existe se descobre na primeira conta que o cliente faz.
- **Sem tabela cadastrada, nenhum número aparece.** É a regra que já vale no site: preço inventado vira promessa comercial.
- Leitura por porta própria (`billing.precosAvulsos`): `site.astro.getPricing` exige administrador do SITE e devolve a configuração inteira do Astro junto; alargar aquela guarda daria a qualquer membro de qualquer organização acesso à configuração do consultor.

---

## O CTA de fim de ★

O 402 do Astro passa a oferecer os dois caminhos: a recarga resolve hoje, o plano resolve todo mês. Quem não é administrador vê a frase de pedir a quem é.

Junto: **agora existe como chegar aos planos sem esbarrar num bloqueio.** Até aqui só se chegava a `/configuracoes/planos` pelo diálogo de limite atingido e pelo card de boas-vindas; o painel de Stars na barra lateral ganhou um "Ver planos".

---

## Pendencias

### Para o João — o gateway
1. `pnpm --filter @nerp/web add @better-auth/stripe`.
2. Migration com o model `Subscription` do plugin (aditiva) e bump do `SCHEMA_VERSION`.
3. `stripe({ stripeClient, stripeWebhookSecret, subscription: { enabled: true, plans: planosParaBetterAuth(), authorizeReference }, organization: { enabled: true } })` em `src/lib/auth.ts`; `stripeClient()` em `auth-client.ts`.
4. Criar os produtos no Stripe e preencher `priceId` e `annualDiscountPriceId` em `planos.ts`.
5. Ligar o botão "Escolher" a `authClient.subscription.upgrade({ plan: plano.id, referenceId: organizationId, customerType: "organization" })`.
6. Em `plano-da-organizacao.ts`, `planoDaOrganizacao()` ainda passa `assinatura: null` fixo — ler a assinatura ativa ali. O `resolverPlano` já tem o ramo pronto e testado.

Nada disso bloqueia o resto: com `priceId` nulo o plano aparece com "Em breve" e botão desligado.

**Diferença deliberada em relação ao NASAEX-WEY:** lá a assinatura é por USUÁRIO e propaga para as organizações dele. Aqui é por ORGANIZAÇÃO (`referenceId = organizationId`), que é o que `resolverPlano` já assume. Não copiar o modelo de lá.

### Funcional
- [ ] A tabela `astro-precos` está vazia (`ativo: false`), então o comparativo ainda não aparece. Cadastrar em `/site/precos`.
- [ ] Os limites de cadastro por plano (lojas, membros) são um palpite comercial: valem uma conferência antes de abrir.
- [ ] `OrigemDoPlano` ainda usa `"gratis"` como valor. É COMO o plano foi decidido, não qual plano é — mas o nome ficou defasado do rótulo da tela.

---

## Decisoes tomadas

- **Nomes do NASAEX-WEY**, inclusive o `id`. Dois vocabulários para o mesmo produto confundem quem transita entre as duas casas.
- **★ inclusas + excedente avulso** (dev). É o que `starsPorCiclo` e o uso extra já modelavam, e é o que sustenta o "pague o que usar".
- **O preço avulso vem do painel, não do código** (dev). Editar sem deploy vale mais do que a garantia de coerência com o plano — e o comparativo some quando a tabela está vazia, que é o comportamento seguro.
- **Mensal e anual desde já** (dev), com os dois campos que o `PlanoDef` já tinha.
- **Teto na cota de ★.** A trava está em teste porque o erro não aparece em tela nenhuma: aparece na fatura.

---

## Testes

- unit `billing/lib/planos.test.ts` (+): os quatro planos na ordem e em preço crescente; todo pago tem preço e o grátis é zero; **nenhuma cota de ★ vale mais que a mensalidade**; o destaque aponta para um plano pago que existe; o anual cobra dez meses; o grátis não tem anual; pago dá ★ por ciclo e o grátis só as de boas-vindas.
- unit `billing/lib/comparativo.test.ts`: soma mínimo e máximo; conta quantas ficaram de fora; ferramenta repetida não conta duas vezes; tabela desligada, ausente ou vazia não produz número; nenhuma ferramenta com preço devolve `sem_modulos`; a economia sai do piso e é nula quando o plano é mais caro.
- component `billing/components/planos.test.tsx` (jsdom, dublando os dois hooks da feature): os quatro nomes; plano sem `priceId` mostra "Em breve" desligado; o atual não oferece troca; o destaque aparece; **sem tabela, nenhum número de comparativo**; com tabela, a soma e a economia; o anual em todo pago; e "lojas ilimitadas" concordando em gênero.
