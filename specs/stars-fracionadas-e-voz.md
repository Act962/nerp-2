# Stars com fração, conversor de tokens e voz no Astro

> O preço de uma ação passa a aceitar 0,2; uma calculadora leva do preço da API do provedor até ★ por mil tokens; e o painel do Astro ganha microfone. Junto vão as correções que tiraram a conversa do beco sem saída.
> Feature: `src/features/stars/lib/{decimal,conversor-de-tokens}.ts` + `packages/astro-widget/src/use-voz.ts`
> Branch: `feat/astro-fase-6-suporte` (continuação, na PR #108)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Três problemas apareceram testando o épico na organização Gotham, e os três tinham a mesma raiz: coisas pensadas para o canal do site, aplicadas ao canal logado.

---

## O que foi feito

### ★ com fração

- [x] **O campo aceita 0,2**, com vírgula, que é como se digita em português. Antes o preço era inteiro, e isso deixava o Astro sem preço justo: 1 ★ por mil tokens é caro demais e 0 desliga a cobrança.
- [x] **O ledger acompanha**: preço, saldo, consumido do ciclo, extrato e o custo gravado em `AstroAcao` viram `numeric(12,2)`. Duas casas e não mais — abaixo de 0,01 ★ a conta vira ruído.
- [x] **O `Math.floor` de `cobrarValor` saiu.** Era ele que transformava qualquer preço abaixo de 1 ★ em zero.
- [x] **`Decimal` morre na fronteira** (`lib/decimal.ts`): sai do banco, passa por `emEstrelas`, e daí em diante é número comum. Inclui a leitura crua do `SELECT … FOR UPDATE`, que o driver devolve como **string** quando a coluna é `numeric` — comparar aquilo com número faria o cobrado sair errado.
- [x] **Um lugar só para arredondar.** Duas regras de arredondamento seriam duas contas diferentes para o mesmo débito, e o extrato deixaria de fechar.
- [x] **Campo vazio ou com lixo trava o botão** em vez de gravar zero: zero DESLIGARIA a cobrança daquela ação sem ninguém pedir.

### Conversor de tokens

- [x] Preço da API por milhão de tokens (entrada e saída separadas, porque a saída custa várias vezes mais), cotação do dólar, quanto vale uma ★ e a margem → **★ por mil tokens**, e também por cem.
- [x] Mostra o custo real, quantos tokens uma ★ compra, e copia o resultado para colar no campo ao lado.
- [x] **Não grava nada, de propósito.** Preço de API e cotação mudam; um número que se atualizasse sozinho por trás da cobrança seria pior que um número velho.
- [x] Os valores de partida são chute, e a tela diz isso.

### Falar com o Astro

- [x] Microfone na caixa de mensagem, no mesmo caminho do NASAEX-WEY: Web Speech API do próprio navegador. Sem biblioteca, sem áudio subindo para lugar nenhum, sem custo por minuto.
- [x] Vermelho pulsando enquanto ouve, e o mesmo clique para.
- [x] **O texto entra no campo, não no envio.** Em português o reconhecimento erra nome de produto e número, e mandar sozinho transformaria cada engano numa pergunta paga — e, diante de um cartão de aprovação, numa ação que a pessoa não pediu.
- [x] Onde o navegador não suporta, o botão não aparece.

### A conversa que morria

- [x] **Aprovação pendurada.** O cartão deixa no histórico uma chamada de ferramenta sem saída. Quem digitasse em vez de responder no cartão mandava isso de volta, e a OpenAI recusa a requisição inteira ("No tool output found for function call"). Como a conversa fica guardada no navegador, a chamada subia de novo a cada tentativa. Agora o servidor descarta pedido sem resposta antes de falar com o modelo.
- [x] **Teto de sessão fora do canal logado.** Ele é do site, onde a contagem é a única trava. Aqui já há ★ cobradas por resposta e o teto diário por organização.
- [x] **Corpo de 60 para 400 mensagens.** É guarda de tamanho de requisição, não de conversa: o modelo já vê só 16.
- [x] **Botão "Nova conversa"** e mensagem própria para o 400.

---

## Pendencias

### Critico
- [ ] **A migration `20260911170000_stars_decimais` NÃO foi aplicada.** Ela troca o tipo de seis colunas de `INTEGER` para `NUMERIC(12,2)`. A conversão não perde dado — todo inteiro cabe em numeric —, mas é troca de tipo, e não acréscimo. Enquanto não rodar, gravar 0,2 no campo de preço grava 0. Rodar com `pnpm db:deploy`.

### Funcional
- [ ] `StarPackage.stars` e `StarsPayment.starsAmount` continuam inteiros de propósito: compra-se ★ inteira.
- [ ] O conversor não busca cotação nem preço de API sozinho. É digitado.
- [ ] A voz não lê a resposta de volta. O NASAEX-WEY tem isso (`voice-output-toggle`), e ficou de fora.

---

## Decisoes tomadas

- **Duas casas, não mais.** Abaixo de 0,01 ★ o valor não muda a decisão de ninguém e a conta vira ruído.
- **A calculadora não grava.** Um preço que se recalcula sozinho a partir de cotação é um preço que muda sem ninguém decidir.
- **A voz preenche o campo.** Reconhecimento erra; mandar sozinho tornaria o erro pago.
- **Pedido de aprovação sem resposta é descartado no SERVIDOR.** O histórico vem do navegador e nunca é premissa.
- **Nada de teto por conversa no canal pago.** Quem paga pela conversa não deve esbarrar num limite no meio do trabalho.

---

## Testes

- unit: `features/stars/lib/decimal.test.ts` — o `Decimal` do Prisma, o número e a **string** do driver dão no mesmo; nulo e lixo viram zero e nunca `NaN`; `0,1 + 0,2` fecha em 0,3; vírgula é aceita; vazio devolve nulo e **não** zero, porque zero desligaria a cobrança.
- unit: `features/stars/lib/conversor-de-tokens.test.ts` — a conta do provedor até a ★ com os fatores certos; a margem multiplica o preço e não o custo; a proporção de saída pesa; proporção fora de 0–1 é contida; ★ valendo zero não divide por zero.
- unit: `features/astro-consultor/server/aprovacoes-pendentes.test.ts` — a chamada que esperava um sim é tirada; aprovada, recusada e já executada ficam; o texto ao lado é preservado; o que a pessoa escreveu não é tocado.
