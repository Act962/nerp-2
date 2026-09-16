# Astro — jornadas guiadas, Fase 1: o varejo inteiro

> Onze jornadas novas cobrindo o miolo do ERP de varejo — estoque, financeiro, cadastros, catálogos, caixa, pedidos, preços e o acesso da equipe. O motor não mudou: cada jornada é um arquivo e alguns `data-jornada` nos componentes. Fase 1 de 4 do épico "jornadas guiadas".
> Feature: `src/features/jornadas/catalogo/*` + `data-jornada` nos componentes das telas
> Branch: `feat/astro-jornadas-fase-0` (a Fase 1 ainda não foi separada — ver "Branch", abaixo)
> Criado em: 2026-09-14 · Atualizado em: 2026-09-14
> Status: 🟡 Em andamento · Pilar: transversal (reduzir suporte)

---

## Situacao atual

A Fase 0 entregou o motor e três jornadas-piloto. O convite do Astro só aparecia em três telas, e o épico promete que **nenhuma função fica de fora**. Esta fase vai de três para quatorze jornadas, cobrindo todo o ERP de varejo que não é Trade nem WhatsApp.

Arquivos principais:
- `src/features/jornadas/catalogo/{estoque,financeiro,cadastros,catalogos,pedidos,precos,operacao}.ts` — os arquivos novos.
- `src/features/jornadas/catalogo/index.ts` — a lista, agora na ordem da barra lateral.
- ~40 `data-jornada` novos, espalhados pelos componentes das telas.

---

## As jornadas desta fase

| Jornada | Tela | ★ | O que ensina |
|---|---|---|---|
| `precos-tabelas` | `/precos` | 10 | preço diferente por tipo de cliente — o recurso que quase ninguém acha sozinho |
| `vendas-consultar` | `/vendas` | 5 | conferir o dia, achar uma venda, o que acontece ao cancelar |
| `caixa-abertura` | `/vendas/caixa` | 10 | abrir com troco, sangria, suprimento, fechar conferindo |
| `pedidos-fluxo` | `/pedidos` | 10 | o cartão andando entre colunas e o painel da TV na cozinha |
| `estoque-movimentacao` | `/estoque/movimentacoes` | 10 | ajuste à mão **contra** entrada de nota, e quando usar cada um |
| `financeiro-lancamentos` | `/financeiro` | 10 | as dez abas giram em torno de um lançamento |
| `clientes-cadastro` | `/clientes` | 5 | a carteira, o cadastro e a importação por planilha |
| `fornecedores-cadastro` | `/fornecedores` | 5 | quem abastece, e o CNPJ preenchendo o cadastro |
| `catalogo-online-configurar` | `/catalogo` | 5 | o interruptor que deixa a loja visível |
| `catalogo-promocional-criar` | `/catalogo-promocional` | 10 | criar o encarte e abrir o editor |
| `colaboradores-equipe` | `/colaboradores` | 5 | colaborador ≠ membro do sistema |
| `configuracoes-acesso` | `/configuracoes` | 10 | convite, permissão e módulo são três coisas diferentes |

---

## O que foi feito

- [x] **Onze jornadas novas**, uma por tela, agrupadas em sete arquivos por afinidade (cadastros juntos, operação junta) em vez de um arquivo por jornada — sete arquivos de trinta linhas se leem melhor que quatorze de dez.
- [x] **A ordem da lista virou a ordem do menu.** A lista dentro do painel do Astro seguia a ordem em que as jornadas foram escritas; agora segue a barra lateral, que é o mapa que a pessoa já tem na cabeça.
- [x] **Âncora nas abas do estoque pelo mesmo caminho da barra lateral**: um campo `jornada` no array `TABS` de `estoque-tabs.tsx`, porque os links saem de um `.map()` e um atributo literal marcaria as quatro abas.
- [x] **Um componente, duas âncoras**: o botão de sangria e o de suprimento são a MESMA instância de `CashMovementDialog` com props diferentes, então a chave sai do `kind` em vez de ser literal.
- [x] **Três testes novos de catálogo**: duas jornadas não podem disputar a mesma tela (o convite mostra só a primeira, e a segunda sumiria sem ninguém notar); todo passo aponta para uma rota válida; e a tela sem jornada continua devolvendo lista vazia.

---

## O que a empresa de teste NAO tem — e como cada passo lida com isso

Esta foi a parte mais trabalhosa. Uma empresa recém-criada não tem venda, nem caixa cadastrado, nem faixa de preço, nem colaborador. Um passo apontando para o que não existe trava a jornada justamente para quem ela existe para ensinar. Por isso, catorze passos nasceram `opcional` (o motor pula em silêncio):

| Tela | O que não existe | Passo |
|---|---|---|
| caixa | nenhum caixa cadastrado, nenhuma sessão aberta | abrir, sangria, suprimento, fechar, gerenciar |
| preços | zero faixas (o seed cria as tabelas, não os preços) | adicionar faixa, opções |
| catálogo promocional | o botão "Editar" do cartão, se não houver catálogo | editar |
| fornecedores | tudo que escreve, para quem só tem leitura | novo, formulário, importar |
| financeiro | o filtro de período, que só existe em algumas abas | período |

---

## O que a verificacao no navegador pegou

Rodado numa empresa de teste criada pelo "Começar agora", tela por tela. Três
achados, e dois deles eram do MOTOR — não do conteúdo:

1. **Laço infinito quando um passo aponta para a tela errada.** O oitavo passo
   do estoque acontece em `/estoque/entradas`, mas herdava a rota da jornada
   (`/estoque/movimentacoes`). O motor procurava o alvo, não achava, avisava; o
   aviso mudava a fase, o efeito de rota disparava de novo, e voltava a
   procurar. O React derrubava a página inteira com *Maximum update depth
   exceeded* — na cara de quem estava aprendendo. Agora `alvoAusente` só volta a
   procurar quando a tela é mesmo a do passo, e um teste prende isso.
2. **`abrirAntes` não abria aba do Radix.** Ele fazia `.click()`, que serve para
   o `Collapsible` do menu mas não para as abas: elas trocam no `pointerdown`.
   O passo do interruptor da loja online ficava esperando para sempre um alvo
   que nunca montava. Virou `abrirGatilho`, que manda ponteiro **e** clique.
3. **O interruptor da loja mora numa aba que não é a padrão** — o passo passou a
   declarar `abrirAntes`.

Conferido funcionando: as doze telas com o convite no lugar e todas as âncoras
presentes; a jornada do estoque atravessando de Movimentações para Entradas; a
do financeiro trocando de aba e montando as âncoras de dentro dela; a do
catálogo online abrindo a aba Visibilidade sozinha; o caixa fechado mostrando
exatamente as três âncoras que existem naquele estado, com as outras quatro
sendo puladas por serem opcionais; e a retomada depois de um F5 no meio.

---

## Decisoes tomadas

- **Uma jornada por tela, não uma por módulo** — Clientes e Fornecedores são telas quase gêmeas, mas quem vende no balcão precisa de uma e quem compra precisa da outra. Juntar faria metade do caminho ser irrelevante para cada pessoa.
- **A jornada do catálogo promocional para na porta do editor** — o editor é uma ferramenta inteira, com jornada própria pela frente. Ensinar a criar e a abrir já resolve a dúvida de entrada.
- **A do PDV não fecha venda e a do caixa não abre caixa** — jornada que mexe no dinheiro sujaria o faturamento de quem está só aprendendo. Elas param no diálogo e explicam.
- **A busca de Clientes ficou de fora da jornada** — ela não está ligada a nada (campo sem valor e sem manipulador). Ensinar um controle que não funciona seria pior do que não ensinar. Virou tarefa à parte.
- **O passo de tela cheia, o de exportar e os menus de linha ficaram de fora** — tudo que vive dentro de um `.map()` marcaria N elementos, e o ganho não paga a complicação de marcar só o primeiro.

---

## Pendencias

### Critico
- [ ] **Branch.** A Fase 0 ainda não foi commitada, então a Fase 1 está na mesma branch. Ao commitar a Fase 0, dá para separar as duas — o corte é limpo: a Fase 1 é só `catalogo/*` mais atributos em componentes.

### Funcional
- [ ] **Faltam as telas sem jornada nesta fase**: Integrações, Cupons, Aplicativos e Mídia do PDV. Integrações e Cupons ficaram de fora porque a empresa de teste não tem nada para mostrar (nenhum provedor instalado, nenhum modelo de cupom), e uma jornada que só mostra estado vazio não ensina.
- [ ] **`/estoque/coletor` e `/estoque/inventarios` só aparecem de passagem**, na explicação das abas. O coletor é tela de celular e merece jornada própria.
- [ ] **Verificação no navegador em andamento** — ver abaixo.

---

## Testes

- unit: `catalogo/catalogo.test.ts` cresceu para 11 casos. Os quatro novos protegem o catálogo de crescer torto: duas jornadas na mesma tela, passo depois de um `navegar` sem declarar a tela nova (foi o que causou o laço), rota inválida e tela sem jornada.
- unit: `engine/maquina.test.ts` ganhou o caso do laço — fora da tela do passo, o aviso de ausência devolve o MESMO objeto, e é essa identidade que impede o ciclo.
- component: `lib/alvo.test.tsx`, novo — `abrirGatilho` manda ponteiro e clique e os eventos sobem; `acharAlvo` não confunde chave com prefixo de outra; e o alvo dentro de um diálogo é desenhado no diálogo.

Totais: **942 testes passando** (eram 915 antes do épico), `pnpm check-types` limpo nos 12 workspaces.
