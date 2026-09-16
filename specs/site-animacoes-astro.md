# Animações do ASTRO — editor no admin do site

> Editor de animações do mascote em `/site/animacoes`, com as cenas gravadas no
> Postgres e desenhadas pelo `apps/site` a partir de um MOMENTO.
> Feature: `packages/site-content/src/astro-animacao.ts` + `apps/web/src/features/site/components/astro-animacao/` + `apps/web/src/app/router/site/animacoes.ts` + `apps/site/src/features/astro/animacao/player.tsx`
> Criado em: 2026-09-13 · Atualizado em: 2026-09-13
> Status: 🟢 implementado, aguardando teste do dev

---

## Situacao atual

O ASTRO já existe como arte (o globo azul do site) e como consultor de IA, mas
nunca se mexeu: cada aparição dele é uma imagem parada. O ponto de partida foi
um mock HTML de um editor de animações em camadas
(`~/Downloads/ASTRO_POSICOES/ASTRO_editor_animacoes_mock.html`) — palco,
lista de camadas, painel de propriedades e linha do tempo — feito fora do
repositório.

Este spec leva o mock para dentro do produto, obedecendo a divisão que o
`apps/site` já segue: **o `apps/web` é dono do estado** (banco, login, R2,
admin) e **o `apps/site` só desenha**.

Arquivos principais:

- `packages/site-content/src/astro-animacao.ts` — o formato (Zod) e o motor do
  tempo. É o contrato: os dois apps perguntam a MESMA função onde cada camada
  está no instante `t`.
- `apps/web/src/app/(site-admin)/site/animacoes/page.tsx` — a página do admin.
- `apps/web/src/features/site/components/astro-animacao/` — `editor`, `palco`
  (Konva), `camadas`, `propriedades`, `linha-do-tempo`.
- `apps/web/src/features/site/lib/astro-catalogo.ts` — lê o manifesto da arte.
- `apps/web/src/app/router/site/animacoes.ts` — `list`/`get`/`save`/`delete`.
- `apps/web/src/app/api/site/astro/animacoes/route.ts` — rota pública (CORS),
  devolve momento → cena.
- `apps/site/src/features/astro/animacao/player.tsx` — o mascote animado em DOM.
- `apps/site/public/astro/camadas/` — a arte: `manifesto.json` (globo, rosto e
  as 48 luvas da arte oficial) e `pecas.json` (12 pares de olhos, 9 bocas, 24
  objetos e 6 fundos).
- `prisma/schema.prisma` — modelo `SiteAstroAnimacao` (`site_astro_animacoes`).

---

## Decisoes tomadas

- **O motor mora no `@nerp/site-content`, não em nenhum dos dois apps.** O
  editor desenha em Konva e o player desenha em DOM; se cada um fizesse a
  própria conta de interpolação, a prévia do editor mentiria sobre o que o
  visitante vê. O pacote não importa React nem Konva — roda no servidor, no
  teste e num futuro renderizador de GIF.

- **A cena inteira é um `Json`, não colunas.** Coluna por propriedade de camada
  significaria migração a cada campo novo, e o formato precisa ser o MESMO que
  trafega pela rede até o `apps/site`. Quem garante o formato é o Zod, nas duas
  pontas: cena torta vira `null` e o mascote não aparece — nunca meia cena.

- **O que publica é o MOMENTO, não um botão "publicar".** `momento` é único e
  aceita nulo: no Postgres vários `NULL` convivem no mesmo índice único, então
  isso dá de graça o par rascunho/publicado das páginas do site, sem uma
  segunda coluna. Cena sem momento existe só no editor.

- **Momento ocupado troca de dono, não dá erro.** Quem salva assumindo um
  momento já tomado devolve o ocupante ao rascunho, dentro de uma transação, e
  o editor avisa quem perdeu o posto. Esbarrar no índice único seria correto e
  inútil.

- **A arte mora no `apps/site` e é COPIADA para o `apps/web`.**
  `apps/web/scripts/copy-astro-camadas.mjs` roda no `dev` e no `build`, como o
  `copy-zxing-wasm.mjs` já faz, e o destino é ignorado pelo git. Três razões:
  o mascote é do site e o site precisa continuar de pé com o ERP fora do ar;
  o caminho público fica idêntico nos dois apps, então a cena gravada desenha
  igual dos dois lados sem tradução; e o Konva precisa das peças na MESMA
  origem, senão o canvas fica marcado e a exportação de quadro morre.

- **Imagem inserida no editor vai para o R2, não vira data URI.** A cena guarda
  a *key*, que é a regra que `constructUrl` (web) e `assetUrl` (site) já
  entendem — a mesma cena desenha nos dois apps e sobrevive a uma troca de
  bucket. Um PNG embutido em base64 incharia o `Json` e a resposta pública.

- **Os tipos de movimento são PRESETS, não um campo novo.** "Flutuar", "girar",
  "tremer" e os outros sete são combinações dos campos que já existem — para
  onde a camada vai, em quanto tempo, com que suavização e quantas vezes.
  Guardar o nome do preset na cena seria guardar uma verdade que envelhece:
  bastaria mexer na duração para o rótulo mentir. O preset escreve nos campos e
  sai de cena. O player não mudou uma linha por causa deles.

- **Nenhum preset toca em `ini`.** A posição de início é de quem arrasta no
  palco; um preset que a mudasse moveria a peça de lugar quando só se pediu um
  movimento. É o que o teste `todo preset parte do início da camada` protege.

- **A prévia de cada movimento roda no MESMO motor da cena.** A bolinha de cada
  quadro é movida por `estadoNoTempo`, não por uma animação em CSS parecida com
  o resultado — uma imitação acabaria discordando do palco no dia em que a
  conta do tempo mudasse, e escolher pela prévia passaria a ser escolher errado.
  O que a prévia NÃO reproduz é a amplitude: um tremor de 12 unidades num quadro
  de 76px seria meio pixel. Cada quadro mede o próprio deslocamento e o
  normaliza — mostra o gesto, e os números reais ficam nos campos ao lado.

- **A suavização é escolhida vendo, não lendo.** `power2.inOut` e `back.out` não
  dizem nada a quem não escreve código; uma bola que sai devagar, acelera e freia
  diz tudo. Os nove quadros percorrem a MESMA distância no MESMO tempo, então a
  única diferença entre eles é o tempo — que é justamente o que a suavização
  decide. O nome continua no gatilho, para quem já sabe o que procura.

- **A bola da prévia tem um brilho fora do centro.** Não é enfeite: um círculo
  liso girado é o mesmo círculo, e "girar" e "balançar" ficavam parados na
  grade. A marca fora do eixo é o que transforma rotação em algo que se vê.

- **O vínculo copia o GESTO, não o lugar.** Marcar camadas no "Vínculo" faz cada
  uma repetir o mesmo deslocamento e os mesmos tempos a partir de onde ela está.
  Copiar o `fim` bruto jogaria todas para cima do líder, que é o contrário do
  que se quer ao mandar a outra mão acompanhar a primeira. A opacidade é o único
  canal com teto — somar o delta pode passar de 1, e o formato recusaria a cena
  inteira por causa disso.

- **O elo fica gravado no SEGUIDOR (`vinculo`), não a lista no líder.** Assim é
  impossível uma camada seguir duas ao mesmo tempo: o campo só cabe um. A tela
  edita a partir do líder, que é como se pensa ("estes vêm comigo"), mas o que
  se grava é a dependência de cada um.

- **A sincronização roda depois de QUALQUER mudança na cena.** É uma passada
  idempotente — mais barato do que descobrir se o que mudou era um líder, e
  imune a esquecer um caminho de edição. De quebra, resolve sozinha os dois
  casos ruins: líder apagado desfaz o vínculo em vez de deixar ponteiro solto, e
  corrente fechada (que a tela impede, mas um `Json` editado à mão não) se
  desfaz em vez de travar.

- **Camada vinculada não mostra os campos de movimento.** Eles viriam do líder e
  seriam reescritos na sincronização seguinte: oferecer a edição seria oferecer
  algo que se perde. O que continua dela é a posição.

- **Mover uma peça leva o movimento junto; mexer no FIM é que desenha o
  movimento.** Editar o início escreve também no fim, pelo mesmo deslocamento.
  Sem isso, arrastar um olho dez pixels transformava um flutuar de 10px numa
  queda de 84px — o destino continuava onde a peça estava antes. Foi o que
  apareceu assim que a cena inicial passou a nascer animada: com início igual ao
  fim, arrastar era inofensivo e o defeito ficava escondido.

- **As 25 poses são DADOS, não cenas congeladas** (`astro-poses.ts`). Cada uma é
  uma receita — que olhos, que boca, que luvas onde, que objetos — resolvida
  contra o mesmo catálogo que o editor usa. Peça redesenhada entra nas 25 sem
  ninguém reescrever nada, e a mesma lista serve ao editor (galeria "Poses") e
  ao `seed-astro-poses.ts` (produção).

- **A galeria das 25 existe para poder JULGAR.** Compor pose a pose no escuro é
  como o enquadramento sai errado; ver as 25 lado a lado foi o que mostrou, de
  uma vez, que quase todas tinham perdido o rosto assimétrico da arte e que uma
  peça vinha quebrada. As miniaturas são DOM, não Konva: são figuras paradas e
  nenhuma precisa de alça, seleção ou exportação.

- **O seed NÃO grava o `momento`.** Pose é ponto de partida, não decisão do que
  vai ao ar. Semear 25 cenas já publicadas trocaria o conteúdo do site sem
  ninguém pedir; quem publica é quem edita, escolhendo o momento na tela.

- **`intervalo`: o descanso entre uma repetição e a seguinte.** Sem ele o
  formato só sabia movimento CONTÍNUO — um ciclo emendava no outro — e não havia
  como dizer "isto acontece de vez em quando". Piscar é um evento de 0,1s a cada
  três segundos, não uma oscilação sem fim: era a peça que faltava, e a tentativa
  de contornar empilhando três olhos em fatias da linha do tempo não podia dar
  certo, porque `atraso` adia o começo mas não ESCONDE a camada antes dele.

- **O descanso é aplicado mapeando o TEMPO, não reescrevendo a conta dos
  ciclos.** `semODescanso` para o relógio no fim do bloco durante o intervalo; com
  `intervalo: 0` a fórmula vira a identidade, e é isso que garante que nenhuma
  cena existente mudou de comportamento. O bloco que se repete é a ida e a volta
  quando há vai e volta — descansar no meio de um vaivém deixaria a peça
  pendurada longe de casa. E `repete` continua contando TRAVESSIAS: o vaivém não
  dobra a conta.

- **Duas posições por camada, não keyframes.** Cada camada tem um estado de
  INÍCIO e um de FIM, e o par no topo do painel diz onde os campos escrevem.
  O que o site pede do mascote é entrar, acenar, pulsar e sair — isso cabe em
  dois estados, e uma linha do tempo com keyframes seria um editor inteiro a
  mais para manter.

- **As 48 luvas são escolhidas num popover, não numa grade aberta.** Elas são a
  identidade da camada — o que a mão está fazendo — então o seletor fica no topo
  do painel, com a luva atual na miniatura. Abertas, as 48 empurravam posição,
  tempo e suavização para fora da tela. E sem `loading="lazy"`: são ~100 KB do
  próprio `/public`, e adiar abria a grade em branco.

- **Quem é mão se decide pelo `src`, não pelo id.** `mao_esq` e `bola` nasceram
  com nome fixo, mas mão acrescentada no editor ganha id gerado. O que define
  uma mão é ela estar desenhando uma luva de `/astro/camadas/maos/`.

- **Dois catálogos, de propósito.** `manifesto.json` é a ARTE OFICIAL
  desmontada — globo, rosto e as 48 luvas recortados do PNG oficial, com as
  posições medidas nele. `pecas.json` é o pacote de EXPRESSÕES feito depois: 12
  pares de olhos, 9 bocas, 24 objetos e 6 fundos. Eles não se fundem porque
  respondem coisas diferentes: um diz como o ASTRO é hoje, o outro diz o que ele
  pode ser.

- **Um fator de escala por FAMÍLIA, não um tamanho por peça.** As peças do
  pacote vêm no tamanho em que foram desenhadas, maior que a régua da cena.
  Normalizar cada uma pela largura faria o "sorriso largo" sair do tamanho do
  sorriso comum — perdendo o que o torna largo. Olhos e bocas ancoram o fator na
  arte oficial (o `aberto` é o olho do manifesto, o `sorriso` é a boca dele);
  objetos não têm âncora e usam 0,26, que põe uma peça de mil pixels perto do
  tamanho de uma mão.

- **Trocar de modelo recoloca a peça no rosto — até ela ser animada.** As bocas
  do pacote são centradas no próprio recorte, e o `sorriso` oficial é um arco
  desenhado no canto do dele: sem recolocar, toda boca nova caía sob o olho
  esquerdo. Os olhos seguem a mesma regra e vão para posições simétricas, porque
  o pacote vem em PARES (um recorte por lado), o que só faz sentido num rosto
  simétrico. A guarda é `ini` e `fim` iguais: assim que a camada tem movimento
  próprio, trocar o desenho não joga fora o trabalho de quem o fez. A cena
  inicial é a exceção que confirma — ela reproduz a assimetria da arte oficial.

- **As miniaturas têm ladrilho cinza médio.** O catálogo mistura arte BRANCA
  (olhos, luvas) e arte ESCURA (a boca aberta): no branco do popover os olhos
  somem, no escuro some a boca. O meio-termo é o único fundo que mostra as
  duas.

- **Espelhar em vez de inventar arte.** `espelhoX`/`espelhoY` ficam na CAMADA e
  não no estado de início/fim — é identidade da peça, e uma camada que
  espelhasse no meio da animação piscaria. Resolve três coisas de uma vez: a
  mesma luva vira a mão do outro lado, o sorriso de cabeça para baixo é a boca
  triste que não existe como arquivo, e os dois olhos ficam simétricos. O
  `escalaComEspelho` mora no pacote porque Konva e DOM precisam do mesmo sinal;
  e a alça de transformação grava a escala em MÓDULO, senão desligaria o
  espelho sozinha.

- **O fundo é imagem OU cor, na mesma camada.** A camada de fundo continua sendo
  do tipo `cor`; se tiver `src`, desenha a imagem esticada na régua da cena —
  nos dois renderizadores. Escolher uma cor limpa o `src`, senão clicar numa cor
  com imagem por baixo não mudaria nada. Transparente vem logo depois do oficial
  porque é o fundo que o widget do consultor quer: o mascote entra por cima da
  tela sem carregar um retângulo consigo. O xadrez atrás dele existe porque um
  quadrado vazio pareceria branco, que é outra das opções da mesma fileira.

- **A paleta cobre tudo o que o X apaga.** Essa é a regra: no dia em que der
  para apagar algo que não dá para repor, o editor vira uma armadilha. Por isso
  "Adicionar" tem globo, boca, os dois olhos, mão, bola branca, balão, os 24
  objetos e o upload — e o X só não aparece no fundo travado, porque cena sem
  fundo não é mais enxuta, é uma cena com buraco.

- **A paleta mora na barra de cima, não sob a lista de camadas.** Acrescentar uma
  peça é ação sobre a CENA, ao lado de "Nova" e "Salvar"; a lista de camadas é o
  retrato do que já existe. Sob ela os botões pareciam parte da lista.

- **Id repetido é que não pode — peça repetida, sim.** Duas bocas ou dois globos
  são cenas legítimas; o que a lista, o palco e a linha do tempo não suportam é
  dois com o mesmo id, porque procuram a camada por ele e o segundo roubaria a
  seleção do primeiro. Quem acrescenta ganha sufixo quando o id já está em uso.

- **O laço da cena não vale para quem repete para sempre.** O relógio corre sem
  ser zerado; quem decide o laço é `quadro`, camada a camada. Quem tem
  repetições contadas precisa do laço para recomeçar, mas quem repete para
  sempre segue no relógio corrido: o ponto em que a cena reinicia não tem
  relação nenhuma com o ciclo dessa camada, e cortar ali fazia a peça SALTAR
  assim que as durações deixavam de ser todas iguais. Exigir que tudo coubesse
  na mesma volta é o contrário do que "para sempre" promete.

- **Cada peça nasce com o próprio compasso** (`COMPASSO`, em `astro-catalogo`),
  com números sem divisor comum. Sete camadas em 1,2 s andam em bloco e voltam
  a coincidir a cada volta — é o que dá a impressão de mecanismo. Assim o rosto
  respira em vez de marchar, e quem anima ajusta a partir daí.

- **A linha do tempo edita por arrasto.** Puxar o corpo da barra muda o atraso,
  puxar a borda direita muda a duração — e os campos do painel escrevem nos
  mesmos dois números, mudando à vista de quem arrasta. A régua é CONGELADA no
  início do arrasto: como a duração total da cena sai da maior soma
  atraso+duração, deixá-la viva faria a barra fugir do cursor. A alça de
  esticar mora dentro da barra e para a propagação do `pointerdown` — senão o
  arrasto sobe para a barra que move e esticar nunca acontece.

- **O editor não é do `apps/site`.** A primeira versão (descartada) morava lá,
  com senha própria em variável de ambiente e as cenas gravadas como arquivo em
  `public/`. Não funciona em produção serverless (disco somente leitura) e
  colocaria login e estado no app que só desenha.

---

## Pendencias

### Critico

- [ ] **Rodar a migration** — `20260913120000_site_astro_animacoes` está escrita
  e ainda NÃO foi aplicada. O banco de dev (Neon) tem drift: ele já tem
  `20260912100000_jornadas_e_melhorias`, que não existe nesta branch. Aplicar
  com `pnpm db:deploy` depois de conferir. Sem a tabela, o editor abre e
  desenha, mas "Salvar" devolve erro.

### Funcional

- [ ] **As 25 poses são aproximações, não cópias da folha de referência.** A
  folha é ilustração acabada, com mãos desenhadas gesto a gesto; o pacote tem 16
  luvas nomeadas. A leitura é a mesma — dorme, comemora, procura — mas o
  enquadramento não é idêntico, e elas entram como ponto de partida editável.

- [ ] **Nenhuma tela chama o `<AstroAnimacao>` ainda.** O player está pronto e
  os nove momentos existem, mas ninguém pediu nenhum deles. O primeiro uso
  natural é `widget-repouso` / `widget-chamando` no widget do consultor.
- [ ] **Exportar GIF** — o mock tinha o botão; o palco é Konva justamente para
  permitir `toDataURL` quadro a quadro. Hoje só existe "Baixar .json".
- [ ] **Posição das peças novas é um chute educado** — as âncoras do rosto
  (`ancoraDaBoca`, `ancoraDoOlho`) foram medidas a olho contra a arte oficial.
  Funcionam, mas quem desenhou o pacote saberia dizer melhor.
- [ ] **Prévia dentro do editor** — o palco mostra o Konva; ver a cena pelo
  `player.tsx` (que é o que o visitante vê) confirmaria que os dois concordam.

### UX

- [ ] **Editor no retrato** — a grade cai para uma coluna, mas não foi
  desenhada para o telefone. É ferramenta de mesa; confirmar se basta.
- [ ] **Sem aviso de alteração não salva** — sair da página perde a cena.

### Qualidade de codigo

- [ ] **O vínculo não viaja no player** — os campos são materializados na cena,
  então `apps/site` desenha certo sem saber que existe vínculo. A relação só
  vive no editor; se um dia o player precisar dela, `sincronizarVinculos` já
  está no pacote.

- [x] **Tailwind 4 centrava a bola duas vezes** — `-translate-x-1/2` compila
  para a propriedade CSS `translate`, independente de `transform` e somada a
  ele: a bola pintada por JS subia meio diâmetro e encostava no teto do quadro.
  A centragem passou para dentro do transform escrito. — ✅ 2026-09-13

- [ ] **Teste de integração das procedures** — falta o caso "momento ocupado
  troca de dono". Não roda nesta máquina (sem Docker); fica para o dev.

---

## Proximos passos

1. Dev roda a migration e testa salvar/abrir/excluir uma cena.
2. Escolher o primeiro momento a entrar de verdade numa tela do site.
3. Exportação de GIF, se o uso pedir.
