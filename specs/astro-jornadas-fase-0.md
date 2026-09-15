# Astro — jornadas guiadas, Fase 0: o motor, a recompensa e o canal de melhorias

> O Astro deixa de só responder e passa a ENSINAR: destaca o botão, explica, e espera a pessoa clicar. Ao concluir, a empresa ganha ★. Junto vem o botão "Melhorias", que leva print e recado direto para a equipe. Fase 0 de 4 do épico "jornadas guiadas".
> Feature: `src/features/jornadas/` + `src/app/router/{jornadas,melhorias}/` + `src/app/(site-admin)/site/{jornadas,melhorias}` + `packages/astro-widget` (prop `ferramentas`)
> Branch: `feat/astro-jornadas-fase-0` (parte de `origin/main`, depois do épico `astro-operacional`)
> Criado em: 2026-09-12 · Atualizado em: 2026-09-12
> Status: 🟡 Em andamento · Pilar: transversal (reduzir suporte)

---

## Situacao atual

O suporte da ÓRBITA ensina o sistema tela a tela, no WhatsApp, uma pessoa de cada vez. O que existia antes desta entrega era o `GuiaCard` do dashboard: uma lista de links com "feito" calculado por contagem (`features/onboarding/lib/trilha.ts`). Ele diz PARA ONDE ir; não ensina o que fazer quando se chega lá.

Agora cada tela pode ter uma jornada: o Astro destaca um elemento por vez com um anel azul pulsante, explica em um balão, e **espera a pessoa clicar**. Nada é feito por ela — um tour que executa sozinho entrega a tarefa e não ensina o caminho, que é o que faz o chamado voltar na semana seguinte.

Arquivos principais:
- `src/features/jornadas/catalogo/` — o catálogo em código: `tipos.ts` (`Jornada`, `Passo`) e uma jornada por módulo. Fase 0 traz três: Dashboard, Produtos e PDV.
- `src/features/jornadas/engine/maquina.ts` — a máquina de estados pura (`reduzir`), onde mora toda regra de avanço.
- `src/features/jornadas/components/jornada-runner.tsx` — o motor no navegador: acha o alvo, posiciona o anel e o balão, ouve o clique da pessoa.
- `src/features/jornadas/server/concluir.ts` — o tempo mínimo conferido pelo servidor, a elegibilidade e a reivindicação atômica da recompensa.
- `src/app/router/jornadas/{listar,iniciar,avancar,concluir}.ts` e `src/app/router/melhorias/enviar.ts`.
- `src/app/router/site/{jornadas,melhorias}.ts` + `src/features/site/components/site-{jornadas,melhorias}.tsx` — o preço de cada jornada e a fila de melhorias, no admin da plataforma.
- `packages/astro-widget/src/astro-widget.tsx` — a prop `ferramentas`, que é como o app pendura botões no cabeçalho do painel sem o pacote conhecer o domínio.

---

## O que foi feito

- [x] **Motor de jornadas sem biblioteca.** Nenhuma lib de tour foi instalada (não havia nenhuma, nem `framer-motion`). Anel e balão são CSS em `globals.css` (`@keyframes jornada-pulso`) posicionados por `getBoundingClientRect` a cada quadro.
- [x] **Quatro tipos de passo**: `ler` (avança no "Próximo"), `clicar` (só o clique no alvo avança), `digitar` (campo deixou de estar vazio), `navegar` (espera a rota chegar).
- [x] **Passo opcional** (`opcional: true`): alvo que pode legitimamente não existir é pulado em silêncio em vez de travar a jornada. Saiu da verificação no navegador — numa empresa recém-criada não há atalhos escolhidos nem aba "Da organização", e sem isto a jornada do dashboard parava no passo 2 para exatamente quem ela existe para ensinar.
- [x] **A âncora é um `data-jornada`** escrito no componente — atributo, não classe nem seletor de estrutura. Colocadas em 14 pontos: cabeçalho e atalhos do dashboard, aba da organização, "Adicionar widget", o `SheetContent` do seletor; busca, painel e "Adicionar Produto" em Produtos, nome/preço/salvar no formulário, "Nova categoria"; busca, primeiro tile, carrinho, "Finalizar Venda" e o diálogo de pagamento no PDV. Mais duas na sidebar, via o campo `NavItem.jornada`.
- [x] **Sobrevive à navegação e ao F5**: a sessão vive no `sessionStorage` (`nerp:jornada:ativa`), gravada de forma síncrona a cada despacho — um `useEffect` perderia a corrida para o `router.push` do passo de clique.
- [x] **Anti-pressa em duas camadas.** No cliente, cada passo tem tempo mínimo de leitura (200 palavras/min, piso de 2 s) e "Próximo" cedo não avança: mostra a fala *"Tá ligado que eu sei que tá com pressa! Mas as ★ só vêm pra quem faz passo a passo."* uma vez por passo. No servidor, `concluir` recusa quando `agora - iniciadaEm` é menor que a soma dos mínimos — medindo contra o `iniciadaEm` que ELE gravou, nunca contra o relógio de quem quer a recompensa.
- [x] **Recompensa uma vez por empresa**, garantida por índice parcial `UNIQUE (organization_id, jornada_id) WHERE stars_creditadas > 0`. Duas conclusões simultâneas: a segunda recebe P2002, grava zero e a tela diz quem resgatou. O crédito passa pelo `creditar()` de `features/stars/server/debitar.ts` — saldo e extrato na mesma transação, com o tipo novo `JORNADA_REWARD`.
- [x] **Convite por tela**: um segundo disco ao lado do Astro nas telas cuja jornada a pessoa ainda não fez, com o mesmo mascote. Abre um diálogo com passos, minutos, ★ e a regra em destaque ANTES de começar. Filtrado por permissão (no servidor) e por visibilidade de módulo (no cliente).
- [x] **Dois botões no painel do Astro**: "Jornadas" (a lista com progresso) e "Melhorias". Ambos FECHAM o painel antes de abrir o diálogo — ele é `z-index: 200` e tela cheia no celular.
- [x] **Melhorias com print**: recado de 10 a 2000 caracteres, até 4 imagens por anexo, colagem ou **"Capturar esta tela"** (`html-to-image`, já dependência, filtrando o próprio painel da foto). Vai para a tabela global `site_melhorias` com a rota de origem e um retrato da empresa e de quem pediu.
- [x] **Duas abas novas no `/site`**, no grupo Plataforma: **Jornadas** (★ por jornada, ativar/desativar, e os números — quantos concluíram, quantas empresas foram pagas, apressos médios) e **Melhorias** (triagem por status, resposta do time).
- [x] **Migration** `20260912100000_jornadas_e_melhorias`: `JornadaProgresso`, `SiteMelhoria`, `SiteMelhoriaStatus`, o valor `JORNADA_REWARD` e o índice parcial. `SCHEMA_VERSION = v96-jornadas-melhorias`.

---

## Pendencias

### Critico
- [ ] **Testes de integração não rodaram** — não há Docker nesta máquina. `apps/web/tests/integration/{jornadas,melhorias}.test.ts` foram escritos e checados por tipo; rodar `docker compose up -d db-test && pnpm test:integration` fica com o dev.
- [ ] **Conferir a recompensa de sandbox em produção.** Nasce ligada (`recompensarSandbox`, em `/site/jornadas`). Conta provisória nunca ganha, mas empresa de teste verificada ganha — se a entrada sem cadastro virar torneira de saldo, o interruptor está na tela.

### Funcional
- [ ] **Print não sobe de uma porta que o R2 não conhece.** A lista de CORS do bucket não tem `localhost:3006` (o worktree de verificação), então o `PUT` assinado é recusado pelo navegador. O texto do pedido chega mesmo assim, que é o comportamento desenhado — mas testar o anexo exige a porta 3000 ou acrescentar a outra à lista do bucket.
- [ ] **Só três jornadas existem.** As Fases 1 a 3 cobrem o resto do menu; sem elas, o disco de convite aparece só em três telas.
- [ ] **`html-to-image` falha por CORS** em telas com imagem do R2 sem `crossorigin`. A captura devolve `null` e o diálogo avisa, mas quem quiser print daquela tela precisa anexar à mão.
- [ ] **A melhoria não notifica ninguém sozinha.** Ela nasce `NOVA` e espera alguém abrir `/site/melhorias` — mesma limitação do chamado de suporte da Fase 6.
- [ ] **O `GuiaCard` do dashboard não conhece as jornadas.** Continua levando para o href da tela; ligar um ao outro é trabalho da Fase 1.

---

## O que a verificacao no navegador pegou

Rodado numa empresa de teste criada pelo próprio "Começar agora", em `localhost:3006`:

1. **A espera pelo alvo se matava sozinha.** O efeito que procura o elemento tinha as funções da sidebar na lista de dependências; como elas trocam de identidade a cada re-render do leiaute, a espera de oito segundos era abortada e recomeçada sem parar. O passo cujo alvo não existia ficava preso para sempre — sem destaque e sem o aviso de "não achei". Agora só o que IDENTIFICA o passo entra nas dependências, e a sidebar entra por referência.
2. **Alvo condicional travava a jornada** — daí o `opcional` acima.
3. **O mascote ignorava a classe de tamanho.** `.o-astro-mark` fixa largura e altura em 100%, então `size-9` no próprio elemento não pegava e a marca estourava o cabeçalho do convite. Quem define o tamanho passou a ser o elemento que a envolve.
4. **Dois botões com o mesmo nome acessível.** O "×" e o botão "Fechar instrução" do balão diziam a mesma coisa para o leitor de tela; o "×" saiu.

Conferido funcionando, ponta a ponta, numa empresa de teste:

- o convite abre sozinho na primeira visita à tela e some depois de dispensado, com o disco continuando lá;
- a jornada começa com o anel no alvo e rola a tela até ele;
- "Próximo" antes do tempo mostra a fala do Astro e **não** avança; depois do tempo mínimo avança gravando quanto durou o passo;
- os dois passos opcionais (atalhos e aba da organização) são pulados sozinhos numa empresa nova;
- o passo de clique não oferece "Próximo", e o clique de verdade no botão abre o painel e avança;
- **o balão do último passo é desenhado DENTRO do painel lateral** e continua clicável — a parte mais arriscada do motor;
- o fecho diz "Esta conta ainda não recebe ★ por jornada", que é a regra anti-farming funcionando: a empresa era de teste com conta provisória;
- **Melhorias**: o painel do Astro fecha antes do diálogo abrir, "Capturar esta tela" vira miniatura sem o próprio painel na foto, e o pedido chega em `site_melhorias` com empresa, usuário e a rota `/dashboard`.

O crédito das ★ em si foi exercitado direto contra o banco (sem Docker, chamando `concluirJornada`): pressa recusada; a primeira pessoa recebe 5 ★ com uma linha `JORNADA_REWARD` no extrato e `balanceAfter` batendo com o saldo; a segunda pessoa da MESMA empresa recebe `ja_resgatada`, zero ★, e o nome de quem resgatou. O extrato ficou com uma linha só.

---

## Decisoes tomadas

- **O catálogo mora em código, não no banco** — cada passo aponta para um `data-jornada` que só existe porque alguém o escreveu no componente. Texto e tela precisam viajar juntos; separados, um renomeia e o outro vira jornada apontando para botão que não existe. O que o admin controla sem deploy é o preço em ★ e se a jornada está no ar.
- **Uma recompensa por EMPRESA, progresso por PESSOA** (dev) — as ★ são saldo da organização; pagar por membro faria uma empresa de dez pessoas receber dez vezes pela mesma jornada. Quem chega depois ainda faz a jornada e o Astro diz que o colega já garantiu as ★.
- **O tempo mínimo é conferido pelo servidor** — a versão do cliente é gentileza (a fala do Astro); a que vale usa o `iniciadaEm` gravado na hora de começar.
- **Conta provisória nunca ganha ★** — ela se cria em um clique, e "conta anônima + empresa nova" seria saldo de graça em série. Empresa de teste, essa ganha: quem está testando é justamente quem precisa aprender, e as ★ da sandbox só se gastam dentro dela.
- **Melhorias em tabela própria, não em `SiteLead`** (dev) — lead é funil de venda, isto é fila de produto. No mesmo lugar, alguém trabalharia um pedido de melhoria como oportunidade comercial, ou a sugestão morreria na caixa de quem só olha vendas.
- **O clique nunca é dado pelo sistema** — sem `preventDefault` no ouvinte, e nenhum `.click()` no alvo do passo. O único `.click()` que existe é no `abrirAntes`, para abrir o grupo do menu onde o alvo mora.
- **O balão é portalado no diálogo quando o alvo está dentro de um** — desenhado no `body`, o clique nele seria clique fora e fecharia o diálogo, e o `pointer-events: none` do Radix deixaria o "Próximo" inerte.
- **A prop do widget é genérica (`ferramentas`)** — o pacote é o mesmo do site institucional, onde não existe jornada nem melhoria. Ele recebe `fechar` porque quem abre diálogo por cima do painel precisa fechá-lo antes.

---

## Testes

- unit: `features/jornadas/engine/maquina.test.ts` (17 casos — pressa não avança e a fala vem uma vez por passo; clique em chave errada é ignorado; "Próximo" não pula passo de clique; digitado vazio não conta; sair da tela volta a procurar; o último passo conclui; falha ao concluir devolve ao último passo sem perder o feito), `lib/{tempo,rota,sessao}.test.ts`, `catalogo/catalogo.test.ts` (ids únicos, módulo existente, todo passo com alvo ou destino, e sub-item de menu obrigado a declarar `abrirAntes`), `server/config.test.ts`.
- component: `convite-dialog.test.tsx` (mostra tempo e ★, avisa a regra antes, diz quando o colega já resgatou, e "Começar" só liga o motor depois do servidor responder), `balao-da-jornada.test.tsx`, `melhorias-dialog.test.tsx` (texto curto não envia; a imagem só sobe no envio, não ao escolher).
- integração (escritos e checados por tipo, **não executados** — sem Docker; o caminho da recompensa foi exercitado à mão contra o banco de desenvolvimento, ver acima): `jornadas.test.ts` (crédito com extrato e `balanceAfter`; o colega recebe `ja_resgatada` e a empresa é paga uma vez só; pressa é recusada e nada é creditado; refazer não paga; jornada valendo zero; sandbox com recompensa desligada; conta provisória; a empresa vizinha não vê progresso nem saldo) e `melhorias.test.ts` (retrato da empresa gravado; print do bucket da vizinha recusado).

Totais depois desta entrega: **933 testes passando** (eram 915 na base), `pnpm check-types` limpo nos 12 workspaces, Biome limpo nos arquivos novos.

---

## O epico: as proximas fases

| Fase | Branch | O que entra |
|---|---|---|
| 0 (esta) | `feat/astro-jornadas-fase-0` | motor, recompensa, admin, melhorias, 3 pilotos |
| 1 | `feat/astro-jornadas-fase-1-varejo` | Estoque (4 telas), Financeiro, Clientes, Fornecedores, Pedidos, Tabelas de preço, Catálogo Online, Catálogo Promocional, Colaboradores, Ranking, Integrações, Configurações (+ Stars, Planos, Avisos), Apps, Caixa/Mídia/Cupons/Leitor |
| 2 | `feat/astro-jornadas-fase-2-trade` | as 15 telas de `/trade/*`, Lojas e Mapas, Books e Padrões, App Promotor e App Vendedor |
| 3 | `feat/astro-jornadas-fase-3-whatsapp-astro` | as 7 telas do WhatsApp e a jornada do próprio Astro (perguntar, aprovar uma ação, ler avisos, ensinar a memória) |

Acrescentar uma jornada é escrever um arquivo em `catalogo/` e pôr os `data-jornada` nos componentes. Nada do motor muda.

---

## Melhorias futuras (nao urgentes)

- Ligar o `GuiaCard` do dashboard às jornadas: "Faça uma venda de teste" viraria o convite da jornada do PDV.
- Jornada com rota dinâmica (`/lojas/:id/mapa`) — hoje `casaRota` compara caminho exato.
- Aviso proativo do Astro quando a empresa tem jornada nova sem fazer, reusando `AstroAviso` da Fase 5.
- Ordenar a lista de jornadas por afinidade com os `interests` escolhidos no onboarding.
