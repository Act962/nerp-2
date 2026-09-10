# Astro — Fase 5: avisos sem ninguém perguntar, e memória por organização

> Três vezes por dia o Astro olha a operação e guarda o que mudou: estoque acabando, ticket abaixo do usual, ação amanhã, contrato vencendo, ★ no fim, conta de teste expirando. O mascote fala o mais grave, o sino do cabeçalho leva à central, e ele passa a lembrar do que combinaram — sempre dentro da organização. Fase 5 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/features/astro/server/avisos/*` + `src/features/astro/server/tools/memoria.ts` + `src/app/router/astro/*` + `packages/astro-widget`
> Branch: `feat/astro-fase-5-avisos-memoria` (empilhada por patch sobre as fases anteriores, todas sem commit)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Até aqui o Astro só falava quando falavam com ele, e esquecia tudo ao fim da conversa. As duas coisas mudam nesta fase, e as duas têm a mesma trava: **nada atravessa organização**.

Arquivos principais:
- `src/features/astro/server/avisos/tipos.ts` — o vocabulário (tipo, severidade, rótulo). Módulo neutro: a central lê daqui.
- `src/features/astro/server/avisos/avaliar-org.ts` — as seis avaliações. Não grava nada.
- `src/features/astro/server/avisos/gravar.ts` — a gravação, a varredura e a limpeza.
- `src/features/astro/server/ticket-usual.ts` — o ticket usual e o corte, extraídos da tool para a tool e o motor darem o mesmo número.
- `src/features/astro/server/tools/memoria.ts` — `lembrar`, `esquecer`, `oQueVoceLembra`.
- `src/features/astro/server/resumir-conversa.ts` — o fecho de conversa longa, **desligado por padrão**.
- `src/app/router/astro/` — listar, marcar lido, marcar falado, marcar todos, listar memória, esquecer.
- `src/features/astro/components/{central-de-avisos,sino-de-avisos}.tsx` e `packages/astro-widget`.

---

## O que foi feito

- [x] **Seis avisos, zero IA** (`avaliarAvisosDaOrg`): estoque abaixo do mínimo, ticket do último dia abaixo do usual, ação nas próximas 24 h, negociação de espaço vencendo em 30 dias, ★ crítica ou zerada, e conta de teste perto de expirar. São consultas ao banco e comparações — pagar um modelo três vezes por dia por organização para descobrir que falta café seria caro e pior, porque o SQL não erra a contagem.
- [x] **Migration** `20260911150000_fase5_astro_avisos_memoria`: `astro_avisos` (com `UNIQUE(organization_id, dedupe_key)`) e `astro_memorias` (com `UNIQUE(organization_id, chave)`). `SCHEMA_VERSION = v92-fase5-astro-avisos-memoria`.
- [x] **A chave de deduplicação carrega o dia** (`tipo:chave:AAAA-MM-DD`): o cron roda três vezes e cria um aviso, não três. Amanhã o mesmo problema vira aviso novo, que é o certo — ele continua de pé.
- [x] **Cron** `astro-avaliar-avisos`, `0 7,13,18 * * 1-6` no fuso de Fortaleza, uma organização por `step.run`: a falha numa não derruba a varredura das outras. Varre só organização verificada ou sandbox com acesso nos últimos 30 dias, e limpa aviso com mais de 45 dias.
- [x] **A audiência do calendário passa por `buildCalendarWhere`**, com o dono como ator. Montar o filtro à mão aqui vazaria evento de loja que o ator não alcança — é a mesma razão da tool de leitura.
- [x] **O mascote fala**: o aviso não lido mais grave vira balão, **uma vez** — quem marca é o servidor (`marcarFalado`), então o mesmo aviso não persegue a pessoa de tela em tela. Com o painel aberto ele não fala, porque os cartões já estão à vista.
- [x] **Selo e cartões**: número de não lidos no botão flutuante, e até três avisos fixados no topo do painel com "Explicar" (que manda a pergunta) e "Já vi".
- [x] **Sino no cabeçalho** levando a `/configuracoes/avisos`, a central com a lista e o "marcar todos como lidos". No PDV o sino não aparece: aviso de estoque no meio de um atendimento é distração.
- [x] **Memória por organização**: `lembrar` (upsert pela chave, então repetir atualiza em vez de acumular), `esquecer`, `oQueVoceLembra`. As duas primeiras pedem o sim no cartão, como toda escrita. Teto de 40 fatos por organização, o mais velho sai.
- [x] **Prompt**: `[O QUE VOCÊ JÁ SABE DESTA EMPRESA]` (até 1.500 caracteres) e `[AVISOS ABERTOS]` (até 5), montados só no canal logado. O canal do site **nunca** recebe memória, nem se quem chamar passar uma por engano — e há teste para isso.
- [x] **Resumo de conversa longa**, `astroConfig.resumirConversas`, **desligado por padrão**: é o único uso de IA fora da conversa. Ligado, fecha conversas de dez mensagens numa frase guardada como memória de origem `resumo`, no máximo cinco por organização, sem nome, telefone ou documento de ninguém.
- [x] **Teto do prompt foi de 12.000 para 12.500 caracteres**, deliberadamente e documentado no teste: a trava existe para pegar um BLOCO entrando sem querer (o texto completo das 28 ferramentas passa de 30 mil), não para proibir três linhas de regra por família de tool nova. O canal do site não cresceu e segue perto de 11 mil.

---

## Pendencias

### Critico
- [ ] **Migration** `pnpm db:deploy` (`astro_avisos`, `astro_memorias`).
- [ ] **Ver o cron rodar**: com o Inngest dev server de pé (`pnpm inngest:dev`), forçar uma passada e conferir que um produto abaixo do mínimo vira selo no mascote e balão.

### Funcional
- [ ] O aviso de **ticket abaixo do usual** olha só o último dia com venda. Uma queda que dure a semana inteira aparece como um aviso por dia, não como um aviso de tendência.
- [ ] **Nenhum aviso é enviado para fora** (e-mail, WhatsApp). Quem não abrir o sistema não fica sabendo — é a mesma limitação do banner de expiração da Fase 1.
- [ ] A central não filtra por tipo nem pagina: 20 avisos por vez, que é o que o cron produz em semanas.
- [ ] O pacote `@nerp/astro-widget` continua sem suíte própria, então o selo e o balão não têm teste de componente. Pendência aberta desde a Fase 3.
- [ ] `resumirConversas` não tem tela: liga-se pela chave `astro-config` em `SiteSetting`.

---

## Decisoes tomadas

- **O aviso é do banco, não do modelo.** Toda a avaliação é SQL. Um modelo lendo a operação três vezes ao dia por organização multiplicaria a fatura pelo número de clientes, e ainda assim contaria pior.
- **A deduplicação é por dia, não por problema.** Um aviso que só nascesse uma vez ficaria mudo enquanto o estoque piora; um por passada viraria spam. O dia é a unidade que a pessoa reconhece.
- **A memória pede aprovação.** Guardar em silêncio o que alguém disse de passagem é a diferença entre um assistente e um gravador. `lembrar` e `esquecer` param no cartão como qualquer escrita.
- **A chave é a identidade do fato.** Sem ela, "lembra que trocamos de fornecedor" acumularia dez versões do mesmo assunto e o prompt carregaria as dez.
- **Memória e avisos moram na mesma tela.** "Por que ele falou isso?" e "o que ele sabe de mim?" são a mesma pergunta por dois ângulos; separá-las esconderia a memória de quem nunca souber que ela existe.
- **O resumo nasce desligado.** É o único ponto de IA fora da conversa; ligá-lo por padrão seria uma chamada a mais por conversa longa em toda a base, que ninguém pediu.
- **O ticket usual virou módulo.** A tool responde e o motor avisa — com dois cálculos parecidos, seriam duas respostas para a mesma pergunta.

---

## Testes

- unit: `features/astro/server/ticket-usual.test.ts` — abaixo de sete dias não há usual; série constante tem corte igual à média; o corte é média menos um desvio; um dia atípico alarga a tolerância (e é por isso que o método vai declarado na resposta).
- unit: `features/astro/server/avisos/tipos.test.ts` — todo tipo tem rótulo, toda severidade tem peso, o mais grave pesa mais, e valor desconhecido não derruba a leitura.
- unit: `features/astro-consultor/server/prompt.test.ts` (+) — no app, memória e avisos entram; **no site, nunca**, nem passados de propósito; sem dados não sobra cabeçalho vazio; a memória é cortada por tamanho, não por contagem.
- integração: `tests/integration/astro-avisos.test.ts` — o motor vê o estoque da própria organização e não o da vizinha; a chave carrega o dia; rodar duas vezes no mesmo dia não duplica e no dia seguinte cria de novo; a lista da A não traz aviso da B; `marcarLido` de aviso da B pela A não encontra nada e não escreve; `lembrar` normaliza a chave e atualiza em vez de duplicar; a memória da A não aparece para a B; `esquecer` o que não existe explica; `esquecer` apaga só a chave pedida e só da própria organização.
