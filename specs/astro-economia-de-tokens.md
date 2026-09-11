# Astro — economia de tokens: ferramentas sob demanda e atalhos sem IA

> Nem toda pergunta precisa de modelo. As ferramentas param de ir todas em toda mensagem, e dez perguntas fechadas passam a ser respondidas direto da consulta, sem custo nenhum.
> Feature: `src/features/astro/server/tools/ativas.ts` + `src/features/astro/server/atalhos/`
> Branch: `feat/astro-economia-de-tokens` (sobre `feat/astro-fase-6-suporte`)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Medido nesta instalação, antes da mudança:

| parte fixa, paga em toda mensagem | caracteres |
|---|---|
| prompt do sistema | 12.115 |
| schemas das 42 ferramentas | 29.814 |
| **total** | **41.929** |

São da ordem de dez a catorze mil tokens de entrada em qualquer mensagem, inclusive num "quantos produtos eu tenho" cuja resposta tem quarenta caracteres. O gasto está quase todo em contexto, não em pensamento.

---

## O que foi feito

### Ferramentas sob demanda

- [x] **`activeTools` por mensagem.** Todas as ferramentas continuam sendo passadas — o conversor precisa delas para reconhecer as chamadas que já estão no histórico —, mas só as escolhidas são oferecidas ao modelo.
- [x] **A leitura da operação nunca sai.** É o valor do Astro, e uma leitura que falta vira "não consigo ver isso" na cara de quem paga.
- [x] **Entram e saem dois grupos**: as do site (catálogo da ÓRBITA, estimativa, formulário), quando a conversa é sobre contratar; e as de escrita, quando alguém pede uma ação.
- [x] **A regra da escrita é generosa de propósito.** Ligar sem precisar custa alguns milhares de caracteres; não ligar quando precisava custa o modelo dizer que criou um catálogo que não existe, porque não havia ferramenta para parar no cartão. Um erro custa dinheiro, o outro custa confiança.
- [x] **Escrita no histórico mantém a escrita ligada** — é assim que o laço de aprovação termina.

Medido depois:

| frase | ferramentas | contexto fixo |
|---|---|---|
| "quanto vendi nos últimos 7 dias" | 25 de 42 | −35% |
| "cria um catálogo com as promoções de café" | 33 de 42 | −18% |
| "quanto custa o módulo de trade" | 34 de 42 | −17% |

### Atalhos sem IA

- [x] **Dez perguntas fechadas** respondidas direto da consulta, sem chamar o modelo: contagem de produtos, clientes, fornecedores e lojas; saldo de ★; total de vendas, ticket médio e produto mais vendido de um período nomeado; catálogos criados; produtos com estoque baixo. Custo: **zero**.
- [x] **A mesma consulta da ferramenta equivalente.** A contagem é a função de `tools/operacao.ts`, a venda passa por `whereVendaValida`, o estoque baixo usa a regra dos widgets. Um segundo caminho de consulta seria o começo de dois números para a mesma pergunta — o erro que a Fase 2 existiu para desfazer.
- [x] **O reconhecedor é desconfiado por construção**: casa a frase inteira, recusa duas perguntas numa só, recusa continuação do turno anterior ("e ontem?"), recusa referência a algo já dito, e recusa pergunta de tempo sem o tempo ("quanto vendi" pode ser hoje, o mês ou o ano — o modelo pergunta de volta, o atalho não sabe perguntar).
- [x] **Na dúvida, cai para o modelo.** E atalho que falha em execução também cai, em vez de derrubar a conversa.
- [x] **Não dispara com anexo** nem em mensagem que não seja da pessoa.
- [x] Resposta identificada no cabeçalho (`x-astro-atalho`) e no log, para dar para medir quanto do tráfego passou por ali.

---

## Pendencias

### Funcional
- [ ] O atalho não guarda a resposta no histórico da sessão como o modelo guardaria: ele responde e pronto. A próxima pergunta que dependa dela cai no modelo, que não verá o número — é o custo de não pagar tokens, e por isso o reconhecedor recusa perguntas de sequência.
- [ ] A lista de dez é um palpite do que é mais perguntado. Vale conferir no log de ferramentas da Fase 6 quais consultas realmente aparecem, e ajustar.
- [ ] O enxugamento de ferramentas não mexe no prompt, que continua com 12 mil caracteres. O índice de domínios poderia sair para uma tool sob demanda — foi cogitado na Fase 2 e continua valendo.

---

## Decisoes tomadas

- **Enxugar ferramenta antes de atalho.** Rende em toda mensagem, não só nas simples, e não tem risco de responder errado: quem decide continua sendo o modelo.
- **Leitura sempre ligada.** A economia não pode custar a resposta.
- **O atalho recusa mais do que aceita.** Disparar errado responde com total confiança a pergunta que ninguém fez, e a pessoa não tem como saber. Recusar só custa tokens.
- **Frase de atalho escrita em código.** Além de barata, é melhor: nunca erra o número.
- **Atalho não cobra ★.** Não houve token; cobrar seria cobrar pelo nada.

---

## Testes

- unit: `features/astro/server/atalhos/reconhecer.test.ts` — as dez perguntas são reconhecidas em variações de escrita; período é lido da frase; pergunta de tempo sem tempo é recusada; e metade dos casos são de RECUSA, que é o risco de verdade: continuação ("e ontem?"), duas perguntas numa, referência a algo já dito, pedido de ação, e as parecidas mas diferentes ("quantos produtos entram no catálogo", "quantos produtos devo comprar").
- unit: `features/astro/server/tools/ativas.test.ts` — a leitura da operação nunca sai, em nenhuma frase; pergunta comum não carrega escrita nem catálogo da ÓRBITA; seis formas de pedir ação ligam a escrita; assunto de contratação liga as do site; escrita no histórico mantém a escrita ligada; e nunca se ativa um nome que não foi montado.
