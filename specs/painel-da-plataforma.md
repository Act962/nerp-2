# Painel da plataforma: empresas, Stars e custo do Gemini

## O problema

Não havia nenhuma visão de cima. Para saber quantas empresas existem, quanto
elas movimentaram, quantos catálogos foram montados ou quanto a IA custou no
mês, só abrindo o banco. E crédito de ★ no suporte era `UPDATE` na mão — sem
extrato, sem autor, sem motivo.

## O que foi feito

Duas abas novas em `/site`, sob um grupo **Plataforma** no menu do admin,
separado do grupo que edita o site institucional: acima se edita o que o
visitante vê, aqui se olha o que os clientes fazem e quanto custam.

### `/site/empresas` — o quadro geral

Quatro indicadores e duas tabelas:

- **empresas ativas** — total menos as de teste (`verifiedAt: null`) e menos as
  paradas. "Ativa" aqui é o oposto de parada, e **não** o status da assinatura:
  o que interessa ao painel é quem está usando.
- **valor gerado** — soma de `Sale.total` no período, pela definição única de
  `whereVendaValida` (CONFIRMED/PROCESSING/COMPLETED, por `createdAt`).
- **catálogos montados** e **ativos** — montados é o total não-demo; ativo é o
  que foi mexido nos últimos 30 dias.
- **sem gerir a conta** — empresas verificadas sem acesso há mais de 14 dias,
  nomeadas uma a uma. É o motivo de a tela existir: total bonito não muda
  nenhuma ação, saber QUAL empresa abriu a conta e não voltou muda.

### `/site/stars` — consumo e custo

Consumo de ★ por empresa, saldo em circulação, tokens, e o custo do provedor —
no período e no mês corrente, contra um orçamento opcional.

**Não existe "saldo do Gemini" para ler.** A API de IA do Google não expõe
endpoint de saldo nem de fatura; esse dado é do Cloud Billing, com outra
credencial e outro escopo. Então a fonte é a nossa: cada sessão guarda tokens e
modelo, e a tabela de preço de `astro/server/modelos.ts` transforma isso em
dólar. É estimativa, e a tela diz isso — mas pela MESMA tabela que cobra o
cliente, o que dá a propriedade que importa: se o que entrou em ★ cobre o que
saiu em dólar, a margem de 50% está de pé.

O teto mensal é **digitado** em `/site/precos` (`orcamentoMensalReais`), porque
não dá para lê-lo. Sem ele, a tela mostra só o gasto em vez de inventar um teto.

### Crédito manual de ★

Busca por nome ou slug (sem acento, sem caixa) e um botão por linha. Sem busca,
a tabela mostra só quem usou a IA; **com** busca, mostra qualquer empresa que
case — quem procura uma empresa pelo nome está indo creditar nela, e escondê-la
por falta de consumo quebraria justo esse caminho.

Três decisões:

- **Só credita.** Tirar ★ por uma tela de admin precisa de mais cuidado que um
  input e um botão, e nenhum caso de suporte pediu isso ainda.
- **Passa pelo mesmo `creditar()`** do crédito de plano e da compra de pacote:
  saldo e extrato na mesma transação. Um `update` direto no saldo daria ★ que
  não aparecem em lugar nenhum.
- **Motivo obrigatório, autor gravado** em `userId`. Ajuste manual sem autor é
  o registro que ninguém explica seis meses depois.

### Reiniciar o Astro de uma empresa

Cada linha da tabela de Stars tem **Reiniciar**, que abre um diagnóstico com as
MESMAS travas da rota, na mesma ordem (desligado → sem chave → teto → saldo),
chamando as mesmas funções. Reimplementar a regra daria um painel que diz
"está tudo bem" enquanto a rota recusa — pior que não ter painel.

O reinício **expira** as sessões abertas (não apaga: elas são o livro-caixa do
custo que esta aba soma) e, sob pedido, zera o contador do teto e apaga a
memória.

**O que ele não consegue fazer.** O histórico da conversa mora no
`sessionStorage` da aba de quem está falando (`packages/astro-widget`) e o
navegador reenvia tudo a cada mensagem. Nenhum botão de servidor apaga isso —
quem apaga é o "Recomeçar" do próprio widget. A tela diz isso em voz alta,
porque um admin que acha que resolveu e não resolveu é o pior resultado.

### Testar a chave

`resolverModelo` só confere se a variável de ambiente existe. Em 11/09 isso
custou uma tarde: a chave estava lá, o diagnóstico dizia "nenhuma trava ativa",
e a Google recusava tudo com `API_KEY_SERVICE_BLOCKED` — a Generative Language
API bloqueada no projeto. O Astro parava de responder e nada no sistema
enxergava.

O botão faz uma chamada real, **um modelo por nível de dificuldade**
(`MODELO_DO_NIVEL`), e mostra a mensagem crua do provedor. Dois detalhes que
custaram a primeira versão:

- testar o "modelo configurado" media a coisa errada — `ASTRO_CONSULTOR_MODEL`
  aponta para a OpenAI, um provedor que o Astro da organização não usa;
- `maxOutputTokens` abaixo de 16 é recusado por validação pela OpenAI, o que
  parece provedor fora do ar.

Um por nível porque a falha pode ser parcial: perguntas leves e pesadas vão
para modelos diferentes, e um teste só esconderia metade do problema.

## Arquitetura

`src/features/site/server/painel-das-empresas.ts` é o **único** lugar do app que
lê através das organizações. Isso é deliberado e está documentado no topo do
arquivo: a regra que sustenta o resto do sistema é que todo handler passa
`organizationId`, e omiti-lo é vazamento. Um `findMany` sem `organizationId`
perdido no meio de `router/<entidade>/` é indistinguível de um bug; naquele
arquivo, ele é o contrato. A guarda é `requireSiteAdminMiddleware`, a mesma das
tabelas `site_*`.

As agregações por empresa vêm em `groupBy` e são casadas em memória — um
`include` por organização faria uma consulta por linha.

`whereVendaValidaGlobal()` foi extraída de `whereVendaValida()` para esse uso, e
o comentário dela diz explicitamente que fora do painel se usa a versão com id.

## Arquivos

| arquivo | papel |
|---|---|
| `features/site/lib/custo-gemini.ts` | módulo puro: soma tokens+modelo em dólar, e o orçamento |
| `features/site/server/painel-das-empresas.ts` | as consultas cross-org |
| `app/router/site/plataforma.ts` | `resumo`, `empresas`, `creditarStars` |
| `features/site/components/site-empresas.tsx` | o quadro geral |
| `features/site/components/site-stars.tsx` | consumo, custo e busca |
| `features/site/components/creditar-stars-dialog.tsx` | o crédito manual |
| `features/site/components/periodo-do-painel.tsx` | janela 7/30/90 dias |
| `features/site/server/reiniciar-astro.ts` | diagnóstico, reinício e teste da chave |
| `features/site/components/reiniciar-astro-dialog.tsx` | a tela dos três |

## Migration

`20260911180000_sessao_guarda_modelo` — `SiteChatSession.modelo String?`,
aditiva. Sem ela os tokens não viram custo: cada modelo tem um preço por mil
tokens e a diferença entre o leve e o Pro passa de dez vezes. Sessões antigas
ficam sem modelo, entram nos tokens e **ficam fora do custo** — a tela informa
quantas foram, porque preço sem modelo é chute.

`SCHEMA_VERSION` bumpado para `v95-sessao-guarda-modelo`.

## Testes

- unit `features/site/lib/custo-gemini.test.ts` — sessão sem modelo não vira
  custo; id e nome do modelo valem igual; a soma é o CUSTO, sem a margem do
  cliente; cotação negativa não vira crédito; orçamento zero não vira barra.
- component `features/site/components/creditar-stars-dialog.test.tsx` — "0,5"
  chega como `0.5`; sem motivo não envia; zero e texto não enviam.

O resto é consulta ao banco e pertence à suíte de integração.

## O roteador aponta para a OpenAI

Em 11/09 a chave da Google foi bloqueada no serviço
(`API_KEY_SERVICE_BLOCKED`, projeto 687139408435): os três modelos Gemini
recusam com 403 e o Astro parou de responder em todas as empresas.
`MODELO_DO_NIVEL` passou a apontar para a família 4.1 da OpenAI — `nano` /
`mini` / cheio —, que é o que o projeto consegue chamar. A escada de preço é a
mesma, então a lógica de dificuldade não mudou, só o destino.

**As linhas do Gemini continuam na tabela.** Não é histórico morto: o painel
resolve o custo de cada sessão antiga pelo modelo que ela gravou, e apagar uma
linha faria o gasto já realizado sumir do relatório sem erro na tela. Voltar
para o Gemini é trocar as três linhas de `MODELO_DO_NIVEL`.

Perda conhecida enquanto a OpenAI atende: busca na web e geração de imagem são
tools do PROVEDOR e só existem no Google — `construirToolsDeBuscaWeb` e
`construirToolsDeImagem` devolvem `{}` sozinhas.

Os preços da 4.1 precisam ser conferidos em openai.com/pricing, como os do
Gemini já pediam: número velho aqui é prejuízo silencioso.

## Armadilha conhecida: `AlertDescription` é `grid`

Cada filho vira uma linha. Texto corrido com `<strong>` no meio quebra em três
pedaços — o conteúdo precisa vir dentro de UM `<p>`.
