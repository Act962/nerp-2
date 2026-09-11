# Quando o nerp ganha uma solução, quem já é cliente fica sabendo

> Hoje uma solução nova nasce invisível para quem já entrou: não está em `interests`, não sobe com o selo "Para você" e não entra no guia. Passa a existir um aviso, uma vez, e uma guarda que impede a próxima de entrar sem ninguém decidir a quem ela serve.
> Feature: `src/features/onboarding/lib/solucoes.ts` + `src/features/astro/server/avisos/avaliar-org.ts`
> Branch: `feat/onboarding-solucoes-novas` (sobre `feat/onboarding-ramo-outro`)
> Criado em: 2026-09-11 · Status: 🟡 Em andamento

---

## Situacao atual

O onboarding guiado grava em `Organization.interests` o que a pessoa marcou. Três coisas leem esse campo: o selo "Para você" no menu, o guia de primeiros passos e o pacote de dados de exemplo.

Todas leem **uma vez, no dia em que a organização nasceu**. Uma solução lançada depois disso:

- não está em `interests` de ninguém que já é cliente;
- não sobe no menu com o selo, porque o selo vem de `interests`;
- não entra no guia, porque os passos vêm de `interests`;
- aparece no menu — `disabledModules` não a contém —, mas em silêncio, entre outras trinta.

Ou seja: para quem já é cliente, a novidade existia no código e não existia no produto.

---

## O que foi feito

- [x] **Cada solução carrega a data em que entrou** (`desde`). É o único dado novo, e é o que permite comparar com a data de criação da organização.
- [x] **`solucoesNovasPara(criadaEm)`** — pura, sem banco: devolve o que apareceu depois que a empresa existe, da mais recente para a mais antiga. Quem entrou depois não recebe nada: para essa pessoa não é novidade, é o catálogo.
- [x] **Aviso `solucao_nova`**, no motor da Fase 5. Zero IA, como o resto: é comparação de data. Aparece no sino, na central e no balão do mascote, que é onde a pessoa já olha.
- [x] **A `dedupeKey` não leva a data**, ao contrário de todos os outros avisos: novidade se conta **uma vez**, e não todo dia enquanto durar.
- [x] **No máximo uma por passada.** Um deploy com três ferramentas novas não vira três cartões de uma vez na cara de quem abriu o sistema para trabalhar; elas saem uma por vez, da mais recente para a mais antiga.
- [x] **A guarda que impede o esquecimento**: um teste falha se uma solução nova entrar sem data, ou sem que alguém decida a quem ela serve — ou algum ramo a sugere, ou ela é exceção declarada em `SEM_SUGESTAO_POR_RAMO`, com o motivo escrito.

A guarda já pegou quatro casos que existiam antes dela:

| solução | o que era | o que ficou |
|---|---|---|
| QR Preço | não sugerida por ramo nenhum | passou a ser sugerida a supermercados e atacarejos, que é de quem ela é |
| TradeGram, Planograma, Books de PDV | idem | exceção declarada: são de quem trabalha o PDV dos outros, e sugeri-las a um supermercado marcaria o que ele não vai usar |

---

## Pendencias

### Funcional
- [ ] **Não há tela para mudar os interesses depois do onboarding.** O aviso diz que a ferramenta existe e onde ela fica, mas quem quiser passá-la para o "Para você" não tem por onde. É a melhoria natural seguinte, e pequena: uma seção em Configurações com os mesmos cartões do passo 2.
- [ ] O guia de primeiros passos não ganha passos da solução nova — ele continua saindo de `interests`. Ligar as duas coisas depende da tela acima.
- [ ] O aviso vale para organização verificada e para sandbox com acesso recente, que é o recorte do cron. Empresa de teste abandonada não recebe, e é o certo.

---

## Decisoes tomadas

- **Data na solução, e não migration.** Comparar `desde` com `createdAt` responde "isto é novo para esta empresa?" sem coluna nova e sem backfill.
- **Aviso, e não e-mail.** A Fase 5 já entrega no sino, na central e no balão do mascote; um segundo canal seria um segundo lugar para ninguém olhar.
- **Uma vez, e não todo dia.** Por isso a chave de deduplicação não leva a data. Novidade que insiste vira ruído.
- **Uma por passada.** O limite não é técnico, é de respeito: três cartões de uma vez não são três novidades, são uma interrupção.
- **A exceção é declarada, não inferida.** Uma lista de "nenhum ramo sugere isto, e eis o porquê" força a decisão a cada solução nova — que é exatamente o que faltava.

---

## Testes

- unit: `features/onboarding/lib/solucoes-novas.test.ts` — a guarda (toda solução tem data; ou um ramo a sugere, ou ela é exceção declarada; e não pode estar nos dois lugares); quem entrou antes recebe, quem entrou depois não; a mais recente vem primeiro; quem entrou no mesmo dia não recebe; e o catálogo de hoje não é novidade para ninguém.
