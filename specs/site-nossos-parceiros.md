# Nossos Parceiros — a entrada na atmosfera

> A seção de parceiros entra entre os números do "Sobre" e a frase final,
> como uma descida à Terra: o planeta se aproxima, a tela embranquece como
> quem atravessa nuvens, os parceiros se apresentam no branco, as marcas
> aparecem em grade sobre o oceano, e a câmera sobe de volta para o rodapé.
> Feature: `apps/site/src/orbita` + `apps/web` (admin e API) + `packages/site-content`
> Criado em: 2026-09-02 · Atualizado em: 2026-09-02
> Status: 🚧 Em andamento — falta aplicar a migração e escrever o admin

---

## Situacao atual

A home é uma viagem contínua: o scroll da página vira um progresso 0→1
(`hooks/use-scroll-timeline.ts`), e desse número saem a câmera, a escala do
planeta e a entrada de cada bloco de texto. Não há seções empilhadas — há uma
linha do tempo.

O trecho final de hoje, em progresso:

| o que | janela |
| --- | --- |
| Impacto ("Tudo conectado. Tudo em movimento.") | 0.775 → 0.878 |
| Sobre ("Orbitamos com você") + os quatro números | 0.856 → 0.932 |
| CTA ("Pronto para orbitar o futuro?") | 0.928 → 0.978 |
| Rodapé | 0.972 → 0.995 |

E as câmeras que interessam (`lib/keyframes.ts`):

| estado | at | posição |
| --- | --- | --- |
| 07 — Impacto | 0.81 | `[-0.52, -1.42, -3.55]` (perto, por trás) |
| 08 — Sobre | 0.885 | `[0.1, 0.45, 7.4]` (longe) |
| 09 — CTA | 0.955 | `[0.7, 0.95, 8.0]` |
| 10 — Footer | 1.0 | `[0.6, 1.05, 8.6]` |

A altura total da viagem é `--o-length: 10` telas no CSS (11 no celular), e
`INTRO_SHARE = 0.1` no timeline é o inverso disso — **os dois têm de mudar
juntos**, senão a passagem de bastão da cortina de abertura desalinha.

Arquivos principais:
- `apps/site/src/orbita/lib/keyframes.ts` — os estados de câmera
- `apps/site/src/orbita/ui/sections.tsx` — as janelas de revelação de cada bloco
- `apps/site/src/orbita/orbita.css` — `--o-length` e o estilo dos blocos
- `apps/site/src/orbita/hooks/use-scroll-timeline.ts` — `INTRO_SHARE`
- `apps/site/src/orbita/scene/` — planeta, atmosfera, estrelas
- `apps/site/src/orbita/fallback/orbita-fallback.tsx` — a mesma narrativa sem WebGL

---

## O que ja esta no repositorio

Feito em 2026-09-02, fora da linha do tempo — são peças isoladas que não
dependem da sequência e já podem ser vistas rodando:

- **`apps/site/src/orbita/scene/planet.tsx` — o mapa de nuvens estava invertido.**
  O arquivo marca a nuvem no escuro (~76% dele é quase branco, que é céu limpo),
  e o shader lia o canal direto: o planeta ficava coberto de nuvem onde deveria
  estar limpo. Daí o ar de bola de neve que aparece no último quadro do
  storyboard. Corrigido para `1.0 - texture2D(cloudMap, vUv).r`, com o
  `smoothstep` de `(0.24, 0.92)` para `(0.16, 0.70)`. **Já aplicado.**

- **`apps/site/src/orbita/scene/ocean.tsx` — a cena do mar, pronta e NÃO
  montada.** Onda de Gerstner no vertex, mapa de normais em três escalas,
  reflexo do céu por Fresnel, brilho GGX e espuma só na crista. Sem textura de
  água: por isso aguenta a câmera chegar perto, que era o risco anotado nesta
  spec. Falta só pendurá-la na linha do tempo — **não reescrever o shader.**

- **`apps/site/public/orbita/textures/water-normal.png`** (512², 190 KB) — o
  mapa de ondulação que o `ocean.tsx` carrega. Gerado para o projeto a partir de
  ruído fractal filtrado: sem origem de terceiro e sem crédito a dever.

- **`apps/site/public/orbita/nave.png`** — a imagem da nave, com a insígnia e o
  letreiro sem sentido cobertos.

Feito depois, já na linha do tempo:

- **`apps/site/src/orbita/lib/timeline.ts` — a viagem alongada.** `--o-length`
  foi de 10 para 18 (11 → 19 no celular) e `INTRO_SHARE` virou `1/18`. Nenhuma
  janela de progresso foi reescrita à mão: elas continuam com os números
  originais, embrulhados em `legacy()`, que reposiciona todas de uma vez.
  O módulo também guarda `DESCENT`, os oito tempos do storyboard.

  **Divergência da spec, deliberada:** o fator é **9/17**, não 10/18. A cortina
  continua com uma tela, então quem se esticou foi só a órbita — de 9 telas
  para 17. Com 10/18 tudo o que já existe ficaria ~5% mais lento; com 9/17 cada
  marco cai na MESMA tela de antes, o que foi conferido na tela um a um
  (hero 2.04, impacto 7.98, números 9.39 — idênticos).

  O CTA, o rodapé e a saída do trilho de progresso **não** passam por
  `legacy()`: nunca estiveram presos a uma cena, e sim ao fim da viagem, que
  agora é depois da descida.

- **`apps/site/src/orbita/scene/ocean.tsx` — montado.** Entra por
  `OceanStage` (`orbita-scene.tsx`), que monta e desmonta a malha nas bordas da
  janela em vez de deixá-la viva a viagem inteira. O espaço inteiro — planeta,
  atmosfera, estrelas, órbita — sai de cena junto (`SpaceStage`), porque o
  plano do mar passa pela origem, que é onde o planeta está. **O shader não foi
  tocado.**

- **`apps/site/src/orbita/lib/ocean-camera.ts` — a câmera do sobrevoo.** Tabela
  própria, em escala de metros, misturada à câmera do espaço por `oceanAmount`.
  Desce de 150 para 11 de altura viajando no sentido do sol. O `far` da câmera
  vai a 2600 e volta junto com ela.

- **`apps/site/src/orbita/scene/orbita-scene.tsx` — o fundo ganhou dono.**
  `SkyBackground` leva `scene.background` do vazio ao azul do céu do mar. Antes
  havia um `<color attach="background">` e um `scene.background = null` no
  `onCreated` disputando o mesmo campo — o que sobrava era preto acima do
  horizonte.

- **`apps/site/src/orbita/lib/quality.ts`** — `oceanSegments` por tier
  (900 / 620 / 420).

E o tempo 4, a travessia:

- **`apps/site/src/orbita/ui/white-pass.tsx` — o branco e a nave.** Um laço só
  escreve as três coisas: a opacidade do véu, a posição da nave e o atributo
  que inverte o cromo. O único estado do React é montar ou não a imagem.

  `WHITE.full` não foi escolhido pelo desenho: é exatamente
  `OCEAN.from - OCEAN.blend`, o ponto em que a câmera troca o espaço pelo mar.
  **O branco existe para cobrir essa emenda** — o corte seco da entrada,
  anotado no passo anterior, deixou de existir.

- **A nave é WebP de 108 KB** (`nave.webp`, gerada do PNG a 88%), deitada por
  `rotate(90deg)` e medida em `vh`: rotacionada, a envergadura vira a dimensão
  vertical, e 118vh garante as asas passando das bordas em qualquer tela.
  Montada só perto da janela — conferido: no carregamento da home ela não está
  no DOM nem é baixada.

  **Divergência da spec:** entra **só em WebP**, sem o PNG de reserva. Todo o
  `public/orbita` já é WebP sem alternativa (marca e texturas), e o PNG original
  tem 949 KB — um fallback que nenhum navegador atual usaria pesaria nove vezes
  mais que o arquivo servido. O PNG fica no repositório como fonte.

- **`data-claro` na raiz resolve o contraste** (`orbita.css`) — e resolve para
  os quatro tempos claros, não só para o branco: logotipo, itens do menu,
  "Entrar", "Começar gratuitamente", trilho de progresso e o botão "Avançar"
  invertem, e o CTA vira o azul cheio da marca. A virada é escrita quando o
  progresso cruza a borda, e a borda cai dentro do branco cheio — ninguém pega
  a troca.

- **`prefers-reduced-motion` já estava resolvido pela arquitetura**: com ele
  ligado, `orbita-experience.tsx` nem monta a experiência imersiva — vai para o
  fallback em CSS. O branco não acontece porque nada daquela camada acontece.

E o tempo 8, a subida:

- **O véu da subida é ESCURO, não branco** (`RISE` em `timeline.ts`,
  `.o-dusk`). A entrada é uma nuvem; a saída é deixar a atmosfera, e o que
  acontece de verdade subindo é o céu perdendo cor até o preto do espaço.
  Resolve três coisas de uma vez: cobre a troca do mar pelo planeta, é
  fisicamente o que se vê, e — como a cor do véu é a mesma do fundo da cena —
  a saída dele não é cortina abrindo, é o planeta surgindo do preto.

- **A câmera sobe ainda sobre a água** antes de qualquer véu: `ocean-camera.ts`
  ganhou uma parada em `at: 1.0` a 260 de altura, olhando para baixo. Primeiro
  se ganha altura de verdade, com o mar afastando; só então a cena troca. É o
  que faz a passagem parecer continuação, e não corte.

- **`OCEAN` passou a ter bordas independentes** (`blendIn` 0.02, `blendOut`
  0.006). A entrada some sob o branco, que é largo; a saída sob o
  escurecimento, que é curto. Uma borda só obrigaria a pior das duas.

- **`LIGHT.to` é calculado a partir de `RISE`, não escrito à mão** — vira com o
  véu em 35%. Tentei em 100% e em 62% primeiro: nos dois a barra passava um
  trecho de tinta escura sobre fundo já escuro, ilegível por ~200px de scroll.
  O fundo do trecho é mar claro escurecendo, e o composto cruza o meio bem
  antes de o véu fechar.

Revisão de 2026-09-02, pedida pelo cliente com um quadro de referência — ela
**substitui** a coreografia descrita acima nos três pontos:

- **A descida é o planeta se aproximando de verdade, não um véu.** A câmera
  desce de 7,4 para **1,35 raios**, onde o planeta cobre 95° e não sobra canto
  preto. Quem embranquece a tela primeiro é a camada de nuvem do próprio
  planeta; o véu branco só fecha o que falta, e fecha **antes** de a textura
  chegar perto o bastante para o pixel aparecer. Estados 09, 10 e 11 em
  `keyframes.ts`.

  Isso exigiu um campo novo: `fit` por estado de câmera. O ajuste por proporção
  de tela serve para enquadrar de longe — num retrato ele recua a câmera para o
  conjunto caber. Descer até a superfície com ele ligado deixaria a câmera a
  três raios de altura em vez de meio. O valor cai de 1 a 0 ao longo da
  descida, e a interpolação faz a troca sem costura.

- **O corte da asa abre o mar.** O branco não se dissolve por igual: ele é
  levado embora pela nave. `--o-corte` acompanha a linha da asa — deitada, ela
  é uma vertical — e o que fica para trás já é oceano. É por isso que a nave só
  entra com a tela 100% branca: **ela precisa de branco para levar.**

  A asa foi medida no arquivo: 73,6% da altura da imagem, o que a põe a 23,6%
  do comprimento à esquerda do centro com a nave de nariz à direita.

  **Direção:** o mar aparece ATRÁS da nave, crescendo pela esquerda. É a única
  direção compatível com "a nave só aparece com o fundo 100% branco" — revelar
  à frente do nariz significaria a tela já estar aberta quando ela entra pela
  esquerda. O quadro de referência sugere o contrário, mas ele não fecha com a
  própria regra. Inverter é trocar o sinal de `RECORTE_ASA` e a direção do
  gradiente, se o cliente confirmar que quis o outro sentido.

- **A subida é a descida ao contrário.** O planeta reaparece colado e recua
  pelo mesmo caminho até o enquadramento de sempre: quando "Pronto para orbitar
  o futuro?" entra, ele já está do tamanho de hoje. Estados 12 a 15. A órbita
  (`OrbitStage`) sai de cena na descida e volta na subida — o anel está a 1,7
  raios e a câmera mergulha até 1,35, então continuar desenhando-o significaria
  atravessá-lo.

**Sobre o quadro de referência enviado:** ele mostra a **arte antiga**, com a
insígnia da NASA e o letreiro "MINIK PBNCS" legíveis. O `nave.png` do
repositório é a versão retocada — conferido recortando as duas asas: os dois
lugares têm o retoque por cima. É a retocada que virou `nave.webp`.

E o conteúdo dos dois tempos:

- **`packages/site-content/src/partners.ts` — o contrato.** `SitePartner` (o
  case, com foto e logo OPCIONAIS) e `SiteBrand` (o logotipo no quadro), mais
  `parsePartners`, que descarta parceiro sem nome e marca sem logo: um registro
  pela metade viraria um buraco no meio da grade. `hasPartnerContent` responde
  se a sequência tem o que mostrar.

- **`apps/site/src/orbita/ui/partners.tsx` — os dois blocos.** `SuccessCases`
  entra sobre o planeta antes de a nuvem fechar (grade 3 × 2, placa escura por
  cartão, porque o fundo ali é continente e nuvem ao mesmo tempo);
  `PartnerBrands` entra sobre o mar depois que a asa abre o branco (quadros de
  vidro, tinta escura, três colunas).

- **Lista vazia = bloco que não existe.** Os dois retornam `null` sem dados.
  Conferido: sem cadastro, nenhum dos dois entra no DOM. Não há estado
  "carregando" nem quadro em branco.

- **`?parceiros=demo`, só em desenvolvimento** (`lib/partners-preview.ts`) —
  conteúdo de ensaio para conferir o leiaute antes de existir cadastro. Nenhum
  arquivo de logotipo entra no repositório: os quadros usam um SVG desenhado na
  hora com as iniciais.

- **As chaves do R2 viram endereço no servidor** (`getSitePartners` em
  `lib/api.ts`), para a pasta `orbita/` seguir sem saber que existe bucket —
  ela não tem um único import com `@/`.

E a camada de dados, escrita mas **não aplicada**:

- **`SitePartner` e `SiteBrand`** no `schema.prisma` + a migração
  `20260902150000_site_partners`, idempotente, no padrão das `site_*`
  anteriores. **Não foi aplicada**: o Docker está fora do ar e o
  `apps/web/.env` aponta para o Neon, que não é lugar de rodar SQL de
  desenvolvimento.

- **`/api/site/partners`** — as duas listas na mesma resposta, aberta, com CORS
  e 60s de cache, só os visíveis, na ordem. `null` do banco vira string vazia
  no contrato: um campo que às vezes é `null` e às vezes `""` obrigaria quem
  consome a testar as duas coisas.

- **`scripts/seed-site-partners.ts`** — seis parceiros e doze marcas de
  mentira. **Recusa banco que não seja local**, a menos que
  `SEED_ALLOW_REMOTE=1`: ele escreve empresa inventada em tabela que alimenta o
  site público, e rodar contra um banco compartilhado por engano publicaria
  seis parceiros que não existem.

- **`packages/site-content/src/partners-sample.ts`** — o conjunto fictício, com
  logotipos e fotos desenhados em SVG na hora. Mora no pacote de contrato
  porque o seed e o preview do site precisam mostrar a MESMA coisa: o que se vê
  em `?parceiros=demo` é o que o banco vai devolver depois do seed.

  **Divergência da spec, a pedido do cliente:** a spec dizia "nenhuma logo entra
  em seed". A regra continua valendo para conteúdo REAL — o que entrou aqui é
  explicitamente fictício, não sai de desenvolvimento e não imita marca
  nenhuma. Foi pedido para poder ver a seção funcionando antes de existir
  cadastro.

Revisão de 2026-09-02 (segunda), pedida pelo cliente. **Ela substitui o véu
branco de CSS descrito acima:**

- **A nuvem virou cena, não opacidade** (`scene/cloud-pass.tsx`). Um `div`
  branco com opacidade parece o que é: uma tela branca subindo por cima. Nuvem
  tem grumo, borda rasgada e some pelos buracos primeiro. Agora é ruído
  fractal com deformação de domínio num plano preso à frente da câmera, e o que
  sobe com o scroll não é a opacidade: **é o limiar que desce**. No começo só
  as cristas passam e aparecem fiapos; no fim o limiar está abaixo do campo
  inteiro e não sobra fresta. Sem textura, então aguenta qualquer aproximação.

- **A nave saiu do DOM e entrou na cena** (`scene/craft-pass.tsx`). Continua
  sendo a mesma imagem — não virou modelo 3D, a decisão da spec segue de pé. O
  que mudou é a camada: no DOM ela ficaria sempre por cima do canvas, como um
  adesivo. Na cena ela entra entre duas passadas de nuvem — uma atrás, uma fina
  à frente —, e é isso que a faz **surgir ENTRE as nuvens**.

- **O escurecimento da subida foi removido.** Quem cobre a troca agora é a
  mesma nuvem, e isso atende o pedido literal do cliente: **o preto do espaço
  só aparece depois de passar pela camada de nuvem**, e não antes dela.
  `.o-dusk` deixou de existir.

- **`.o-white`, `.o-dusk` e `.o-craft` saíram do CSS**, e `ui/white-pass.tsx`
  virou `ui/light-chrome.tsx` — do que era a travessia inteira no DOM sobrou o
  que é DOM mesmo: a cor do texto sobre fundo claro.

- **A linha azul acima dos números do "Sobre"** (`.o-stats::before`) foi
  removida a pedido. Os pontos de cada indicador ficaram — eles pousavam sobre
  ela, e sem ela são quatro pontos soltos; vale rever.

E o céu, a partir da foto de referência que o cliente enviou
(`mar-e-fundo-de-ceu-azul`, 2026-09-02):

- **`scene/sky-pass.tsx` — o céu virou céu.** Acima do horizonte havia uma cor
  chapada, e ela precisava ser pálida para encontrar a névoa do mar sem
  emenda: o resultado era o horizonte branco de que o cliente reclamou. Agora
  são quatro paradas medidas na foto — `#0141ab` no zênite, `#016fd9`,
  `#06acf6` e `#5ab4ed` na linha do horizonte — mais uma faixa de cúmulos
  rasteiros, que é o que separa "degradê" de "céu".

  A direção do raio sai da geometria: o plano cobre o quadro, então a posição
  de mundo de cada pixel menos a da câmera dá o raio dele. Não é cúpula, é um
  passe.

- **Menos branco na água** (`scene/ocean.tsx`, só constantes — a lógica do
  shader não foi tocada):
  - `OCEAN_SKY_LOW`/`HIGH` eram quase brancos (`#d8e6f2`). Água reflete céu, e
    céu branco devolve mar branco. Agora `#7fc2ea` / `#0a55b4`.
  - o disco do sol no reflexo caiu de `5.0` para `2.6`;
  - o rastro GGX, de `0.28` com teto `2.2`, para `0.15` com teto `1.0` — ele
    cobria metade da água de branco;
  - a espuma, de `0.40`/`0.50` para `0.26`/`0.32`;
  - `uDeep` era quase preto (`#02101d`), o que jogava todo o contraste no
    reflexo e deixava a água com cara de metal. Agora `#04173f` / `#1f6fb8`.
  - o clarão do sol no céu tinha expoente 22 e lavava um terço do quadro pela
    esquerda; foi para 140.

**Um bug de fila de renderização:** o passe do céu nasceu `transparent: true`,
e material transparente entra numa fila que o three desenha DEPOIS de toda a
geometria opaca — `renderOrder` não atravessa essa separação. O céu era pintado
por cima do mar, e o mar sumia. Sendo opaco, ele volta para a fila certa e
desaparece misturando-se ao vazio, não pela transparência.

**Dois bugs encontrados na montagem da nuvem:**

1. **Xadrez de blocos na densidade alta.** A primeira versão ampliava o campo
   dividindo o `uv` pela densidade, e comprimia tanto a amostragem que sobravam
   duas ou três células de ruído na tela inteira. Agora a escala quase não
   muda: quem anda é a profundidade, e a câmera atravessa camadas novas em vez
   de esticar as mesmas. As oitavas também passaram a girar entre si — sem
   isso, todas alinhadas ao mesmo eixo deixavam um xadrez de fundo.

2. **Nuvem e nave sumiam sobre o mar.** Os dois planos ficavam a 0.4 da câmera,
   e o `near` sobe de 0.05 para 0.5 no sobrevoo (o mar precisa de
   profundidade): eles caíam atrás do plano de recorte justamente no trecho em
   que cobrem a troca de cena. A distância agora acompanha `camera.near`.

**Bug encontrado e corrigido na montagem:** o planeta e o mar apareciam no
mesmo quadro entre 0.632 e 0.652 — o planeta boiando no oceano. `OceanStage`
montava a malha com folga (certo, para a geometria estar pronta) mas a deixava
visível já montada. Agora montar e aparecer são coisas diferentes:
`OceanVisibility` usa o mesmo corte do `SpaceStage` (`oceanAmount`), então não
existe instante com os dois em cena.

---

## O que se quer

Definido pelo storyboard `transicao_telas_site_orbita.pdf` (2026-09-02).
**Ele muda o desenho anterior**: não são cinco tempos entre o "Sobre" e a frase
final — é uma descida e uma subida completas, com quatro blocos de conteúdo
pendurados nelas.

| # | tempo | o que se vê |
| --- | --- | --- |
| 1 | **Do espaço** | A Terra ao longe, fundo preto, estrelas — a cena de hoje. |
| 2 | **Descida** | A câmera desce; o planeta cresce até o preto sumir e sobrar só oceano e continente. |
| 3 | **Cases de Sucesso** | Nuvens entram pela esquerda; o título e **seis cartões em grade 3 × 2** aparecem sobre o planeta. Os cartões se dispersam conforme a nuvem engrossa. |
| 4 | **A travessia** | Branco total. A nave entra pela esquerda, nariz à direita, asas passando das bordas, e atravessa. |
| 5 | **Nossos Parceiros** | Enquanto a nave sai pela direita, o branco abre sobre o mar visto de cima e entram o título e **três quadros transparentes com as logos**. |
| 6 | **O mar** | Os quadros somem; o mar de perto, depois o horizonte com o céu claro. |
| 7 | **O convite** | "Mais que sistemas, um universo de soluções para sua empresa" com um **cartão de vídeo** ao centro. |
| 8 | **Subida** | A câmera sobe: horizonte → satélite → planeta inteiro → o espaço preto e o logotipo, reencontrando a viagem de hoje. |

Três coisas que **contradizem o que estava escrito antes** e mandam nesta versão:

- **"Cases de Sucesso" é um bloco próprio, antes do branco** — não a
  apresentação dos parceiros dentro do branco. No branco só existe a nave.
- **A grade de marcas virou três quadros**, não 3 × 6 com paginação. A
  paginação sai do escopo até a lista crescer.
- **Existe um bloco de vídeo no fim**, que não estava em lugar nenhum da spec.

## Pendencias

### Critico

- [x] **A viagem precisa ficar mais longa** — FEITO (ver acima).
      ~~Texto original:~~ (`orbita.css`,
      `use-scroll-timeline.ts`) — o trecho de 0.93 a 1.0 tem meia tela de
      scroll, e a sequência do storyboard precisa de **oito tempos**, não três.
      Subir `--o-length` de 10 para **18** (e de 11 para 19 no celular) e
      ajustar `INTRO_SHARE` para `1/18`.
      **Isso reposiciona TODA a linha do tempo:** todo valor de progresso
      anterior à inserção precisa ser multiplicado por `10/18` (0.5556), e o
      CTA e o rodapé passam para depois da nova sequência. Os valores afetados
      estão em `CAMERA_STATES` (`lib/keyframes.ts`) e nas janelas de
      `ui/sections.tsx`. Fazer isso de uma vez, conferindo na tela — não é uma
      mudança que se valida por leitura.

- [ ] **Lista vazia, tempo que não existe** — cada tempo depende da sua lista.
      Sem parceiros, o branco e a apresentação são pulados; sem marcas, a grade
      é pulada; sem nenhum dos dois, a sequência inteira sai e a linha do tempo
      volta a ser a de hoje. Nada de tela branca seguida de grade vazia. Vale
      para o primeiro deploy, para o banco fora do ar e para quem apagar tudo no
      admin.

- [ ] **O branco não pode ser um flash** — o site é escuro, e um corte para
      branco em tela cheia é desconforto e risco para quem tem
      fotossensibilidade. A transição sobe com o scroll (o usuário controla o
      ritmo) e nunca por conta própria. Com `prefers-reduced-motion`, o branco
      não acontece: os parceiros aparecem sobre o fundo escuro normal.

- [ ] **Logo de terceiro só entra com autorização** — os três quadros do
      storyboard trazem marcas reais de empresas grandes. Marca registrada num
      site comercial afirma uma relação: só publicar a de quem é parceiro de
      fato e autorizou por escrito, e guardar essa autorização. Enquanto não
      houver, a seção nasce com a lista vazia e, pela regra acima, some da
      viagem. **Decidido: nenhuma logo vai no código** — o cliente cadastra
      todas pelo admin, e é lá que a autorização se resolve.

### Funcional

- [ ] **Dois modelos, não um** (`apps/web/prisma/schema.prisma`) — porque são
      duas coisas com campos e propósitos diferentes:

      `SitePartner` — o case. `name`, `logo` (key do R2, **opcional**), `photo`
      (key do R2, **opcional**), `story` (texto, o parágrafo), `href`
      (opcional), `position`, `visible`.

      `SiteBrand` — a marca da grade. `name`, `logo` (key do R2), `href`
      (opcional), `position`, `visible`.

      As duas globais, como as outras `site_*`, com migração à mão no padrão das
      existentes. Um campo `kind` numa tabela só pareceria mais econômico e
      obrigaria metade dos campos a ficarem nulos na outra metade das linhas.

- [ ] **Foto e logo são opcionais no parceiro** — e o card se adapta aos quatro
      casos: com as duas, só foto, só logo, nenhuma. Sem imagem nenhuma, o card
      é o nome e a história, com o mesmo peso tipográfico dos outros — não um
      buraco cinza esperando upload.

- [ ] **"Cases de Sucesso" é um bloco novo** (`SitePartner` já serve) — seis
      cartões em grade 3 × 2 sobre o planeta, antes do branco. É aqui que entram
      foto, nome e o parágrafo da história; o storyboard mostra os cartões
      vazios porque o conteúdo ainda não existe. Com menos de seis, a grade
      preenche o que tem e centraliza — nada de cartão fantasma.

- [ ] **O bloco de vídeo do fim** — "Mais que sistemas, um universo de soluções
      para sua empresa" com um cartão de play ao centro. O tipo `video` já
      existe em `packages/site-content/src/blocks.ts` com `youtubeId`; falta o
      vídeo em si e decidir se abre em modal ou toca no lugar. Sem vídeo
      cadastrado, o cartão não aparece e sobra só a frase.

- [ ] **Admin das duas listas** (`apps/web/src/app/(site-admin)/site/parceiros`)
      — uma tela com duas abas, "Parceiros" e "Marcas". Ordenação, formulário e
      upload reusando `SiteImagePicker` e o padrão de `site-menu-manager.tsx`.

- [ ] **API pública** (`apps/web/src/app/api/site/partners/route.ts`) — devolve
      as duas listas na mesma resposta (`{ partners, brands }`), para o site não
      pagar duas viagens. Aberta, com CORS e cache de 60s, só os visíveis, na
      ordem. Os tipos vão para `packages/site-content`.

- [ ] **Paginação só quando precisa** — 18 marcas por página (3 × 6). **Com as
      dez de hoje a paginação não aparece**, e a grade não pode ficar com oito
      quadros vazios: ela preenche o que existe e centraliza a última linha. Os
      botões entram a partir da 19ª marca, e mudam a página **sem mexer no
      scroll** — a câmera continua onde está, só o conteúdo troca.

### UX

- [ ] **O ritmo do branco, com dez parceiros** — um por vez levaria dez tempos e
      esticaria demais a viagem. Aos pares no desktop (cinco tempos, ~0.25 tela
      cada) e um por vez no celular, onde não cabem dois lado a lado. Cada par
      entra e sai com o scroll, como os blocos de texto já fazem.

- [ ] **A grade no celular** — 3 × 6 em 390px daria quadros de 55px. Cair para
      3 colunas × 6 linhas, mantendo 18 por página.

- [ ] **Contraste no branco** — a barra de navegação, o logotipo e o botão do
      WhatsApp são claros e somem sobre branco. Enquanto a tela estiver clara,
      eles precisam inverter (o painel do menu já faz isso com um filtro; ver
      `.o-nav[data-mega]` em `orbita.css`).

### Qualidade de codigo

- [ ] **O oceano é uma cena própria, procedural — não o planeta de perto**
      (`apps/site/src/orbita/scene/ocean.tsx`). A ideia original de descer a
      câmera até a superfície do planeta não sobrevive: as texturas são 2k/4k e
      de perto o pixel aparece. A saída é um plano com shader próprio — ondas de
      Gerstner somadas no vertex, cor por Fresnel no fragment, espuma na crista,
      névoa exponencial até o horizonte. **Sem textura nenhuma**, e por isso sem
      limite de aproximação. Já testado e renderizado (ver `mar-nave.png` no
      histórico da conversa): aguenta tanto o horizonte quanto a vista quase a
      pino. Custo: um plano de ~900 × 900 segmentos, que só entra em cena na
      janela da seção e sai depois — nunca junto com o planeta.

- [ ] **A nave que atravessa o branco é uma imagem, não um modelo 3D**
      (`apps/site/src/orbita/ui/craft-pass.tsx`) — decidido em 2026-09-02, com o
      cliente enviando o arquivo do ônibus espacial e o enquadramento que quer.
      Ela entra pela esquerda e sai pela direita, deitada com o nariz para a
      direita, **grande o bastante para as asas passarem das bordas de cima e de
      baixo** (referência: o print do avião que o cliente mandou).

      Isso dispensa `GLTFLoader`, Draco e o primeiro `.glb` do projeto — a
      travessia é vista de cima e de lado, sem paralaxe, e a imagem entrega o
      mesmo efeito por uma fração do peso. **Não é 3D e não precisa ser.**
      O que é 3D é o que está atrás: o mar, o céu e a névoa.

      Como se comporta:
      - Uma `<img>` posicionada por `transform`, escrita pelo loop de
        `lib/reveal.ts` junto com o resto — nada de estado do React por quadro.
      - A largura acompanha o progresso (afasta um pouco enquanto atravessa) e
        vem de `vw`, não de pixels fixos, para o enquadramento sobreviver ao
        celular.
      - `will-change: transform` e nada mais; a imagem em WebP com o PNG como
        reserva, e o arquivo abaixo de 300 KB.
      - Com `prefers-reduced-motion`, a nave não atravessa: aparece parada e
        some, sem o voo.

- [ ] **As marcações do arquivo enviado precisam sair** — no tamanho que o
      enquadramento pede, o letreiro da asa fica legível e diz
      **"MINIK PBNCS"**, que não é palavra nenhuma; a insígnia ao lado está
      deformada. São marcas de imagem gerada por IA, e num site que se apresenta
      como premium isso é lido como erro. Já existe uma versão com as duas
      cobertas (`nave-limpa.png`, no histórico da conversa) — a silhueta do
      ônibus espacial continua inteira sem elas. Some a isso a ressalva de
      sempre: insígnia da NASA em site comercial sugere endosso que não existe.

- [ ] **O fallback sem WebGL** (`fallback/orbita-fallback.tsx`) — a seção existe
      lá também, sem atmosfera: título, os parceiros com foto/logo/história e a
      grade das marcas, em CSS. Quem entra sem WebGL não pode perder a seção.

- [ ] **Uma janela só para o branco** — o embranquecimento é um overlay com
      opacidade escrita pelo loop de `lib/reveal.ts`, não um estado do React.
      Nada de re-render por frame.

---

## Perguntas em aberto

1. ~~**A imagem entra como está ou sem as marcações?**~~ Conferido no arquivo em
   2026-09-02: o `nave.png` do repositório **já é a versão limpa** — as duas
   asas têm o retângulo claro por cima de onde estavam o letreiro e a insígnia.
   É essa que virou `nave.webp`. Confirmar com o cliente se o retoque está a
   contento no tamanho de tela cheia, que é onde ele aparece.

2. **A imagem tem 910 × 1400.** No enquadramento de 118vh ela é ampliada cerca
   de duas vezes numa tela retina. Passa, porque a travessia é rápida e o
   movimento esconde — mas se o cliente tiver o arquivo em resolução maior, é
   troca de asset, sem tocar em código.

## Achado durante a montagem do mar

- [x] **As duas bordas do mar** — resolvidas: a de entrada pelo corte da asa
      sobre o branco, a de saída pelo escurecimento da subida. Não há mais
      corte seco em nenhum ponto da sequência.

- [x] **A barra de navegação some sobre o mar** — resolvido por `data-claro`,
      que vale pela janela clara inteira (`LIGHT`), não só pelo branco.

- [ ] **Céu chapado acima do horizonte.** `SkyBackground` usa uma cor só, que
      encontra a névoa do mar sem emenda no horizonte mas não tem gradiente para
      o zênite. Aguenta os quadros de hoje; se a câmera subir o olhar na
      travessia, vira um refinamento a fazer (o `sky()` do shader do mar já tem
      a fórmula das duas paradas).
---

## Decisoes tomadas

Respondidas pelo cliente em 2026-09-02:

1. **Dez parceiros hoje.** Por isso a paginação nasce pronta mas escondida, e a
   grade precisa se comportar bem incompleta.
2. **A história é um parágrafo pequeno.** Cabe no branco; não pede página
   própria. Se um dia virar case longo, o caminho é o parceiro linkar para
   `/sobre/cases-de-sucesso`.
3. **Foto e logo são opcionais.** O card se vira com o que tiver.
4. **Parceiros e marcas são listas diferentes.** Parceiro funciona como case de
   sucesso; marca é logo na grade. Daí os dois modelos.
5. **O sobrevoo é 3D de verdade**, com oceano procedural — e não o planeta visto
   de perto, que não aguenta a aproximação. Confirmado por render, não por
   suposição.
6. **Uma nave atravessa o branco**, no lugar do avião da referência: entra pela
   esquerda, sai pela direita, nariz para a direita, asas passando das bordas.
7. **A nave é imagem, não modelo 3D.** O cliente enviou o arquivo do ônibus
   espacial e o enquadramento; o efeito não pede paralaxe, então não pede `.glb`.
   Cai junto toda a discussão de peso, `GLTFLoader` e compressão.

---

## Como validar

Não dá para conferir isto por leitura de código. Depois de implementar:

1. Antes de qualquer coisa, o oceano isolado: uma página só com a cena do mar,
   passeando a câmera do horizonte até quase a pino, procurando repetição de
   padrão e cintilação nas cristas em movimento (o quadro parado engana; o
   *aliasing* do especular só aparece animado).
2. `pnpm --filter @nerp/site dev` e percorrer a viagem inteira **devagar**,
   conferindo que nada do que já existia mudou de lugar — o reposicionamento da
   linha do tempo é a parte que quebra em silêncio.
3. Repetir no celular, onde `--o-length` é diferente.
4. Ligar `prefers-reduced-motion` no sistema e confirmar que o branco não
   acontece.
5. Apagar todos os parceiros no admin e confirmar que a viagem volta a ser a de
   hoje, sem buraco.
6. Medir o carregamento da home com a aba de rede: a imagem da nave **não pode
   aparecer** no carregamento inicial — só quando a seção se aproxima.
7. Conferir o enquadramento da travessia no celular: as asas têm de continuar
   passando das bordas de cima e de baixo, que é o que dá a escala.

---

## Ajuste no "Sobre" (2026-09-02)

O bloco "Orbitamos com você em cada desafio" ficava nítido por 0.020 de
progresso, contra 0.115 a 0.182 de cada título da suíte — sumia antes de ser
lido. A janela não podia crescer para trás, onde está o impacto, então cresceu
**para a frente, entrando no primeiro tempo da descida**: `DESCENT.espaco` é um
trecho em que a câmera ainda não se move e não há nada mais na tela, então o
texto acompanha o planeta começando a crescer e sai quando a descida de fato
começa (real 0.545, tela 10.27).

Nítido por 1,04 tela de scroll, contra 0,18 antes. Conferido rolando de
verdade, não forçando o estado.

## Conteudo das paginas internas (2026-09-02)

Pedido do cliente: as 28 páginas de Soluções e as 6 de Segmentos vão ao ar com
este PR, faltando só as imagens. O que mudou:

- **`packages/site-content/src/pages.ts`** — as 28 ferramentas ganharam
  `compare` e `split`. Antes só `tracking` tinha texto aprovado e as outras 27
  nasciam com os dois blocos desligados.

- **`packages/site-content/src/segments.ts`** — os 6 segmentos ganharam os
  mesmos dois blocos, derivados das ferramentas que cada um lista.

- **O critério, que é o que separa isto de texto de venda:** cada linha de
  **MAIS** é uma funcionalidade que existe no catálogo; cada linha de **MENOS**
  é a ausência LITERAL dela — o trabalho manual que ela substitui. Não há
  promessa de resultado ("vende mais", "economiza X") em lugar nenhum. O
  `split` resume em uma frase as funcionalidades já listadas.

- **`video` e `clients` continuam desligados** nas 34 páginas: dependem de
  material que não existe (vídeo gravado, logotipo autorizado), e ligados
  vazios apareceriam como buraco.

- **`apps/web/scripts/seed-site-content.ts` — duas correções que bloqueavam a
  ida ao ar:**
  1. as páginas nasciam como `DRAFT`, e rascunho é **404** no site. Trinta e
     quatro itens de menu levariam a lugar nenhum até alguém publicar um a um.
     Agora nascem `PUBLISHED`, com `publishedBlocks` preenchido. Uma página
     verdadeira e sem foto é melhor do que um 404;
  2. página que já existia era **pulada**, então o conteúdo novo nunca
     chegaria a um banco já semeado. `SEED_SITE_REFRESH=1` traz o catálogo
     atualizado e publica; sem a variável, o comportamento conservador
     continua — o admin é a fonte de verdade depois do primeiro seed.

**68 imagens a subir pelo admin** (o `hero` e o `split` de cada página). Onde
falta imagem o renderizador desenha uma moldura vazia (`sp-media--empty`), não
um buraco.

## O que falta

A coreografia está inteira e os dois blocos de conteúdo existem e se desenham.
**O que falta é a camada de dados** — sem ela não há como cadastrar nada, e a
seção não aparece para ninguém:

- [x] `SitePartner` e `SiteBrand` no `schema.prisma`, com migração à mão —
      **escrita, falta aplicar**;
- [x] `apps/web/src/app/api/site/partners/route.ts`;
- [ ] **rodar `pnpm --filter @nerp/web db:generate`** — sem isso
      `prisma.sitePartner` é `undefined` em runtime e o `apps/web` não
      compila. Não rodei: comando Prisma não é meu para executar aqui;
- [ ] aplicar a migração num banco local (Docker fora do ar hoje);
- [x] a tela do admin em `(site-admin)/site/parceiros`, com as duas abas —
      FEITO. `router/site/partners.ts` (listar, salvar, reordenar, mostrar,
      excluir para cada lista), os hooks em `use-site-admin.ts` e
      `site-partners-manager.tsx`, no padrão de `site-menu-manager.tsx`.

      **Permissão, com uma diferença em relação ao menu:** aqui o REDATOR
      edita, porque o que ele mexe É o conteúdo — "só texto e imagem", diz o
      papel. O que ele não faz é mudar a lista: criar, reordenar e excluir
      ficam com EDITOR, e excluir só com o super admin.

      As duas listas invalidam juntas: alimentam a mesma resposta pública e o
      mesmo trecho da viagem, e atualizar uma só mostraria metade da seção
      nova.
- [ ] o bloco de vídeo do convite (tempo 7);
- [ ] o fallback sem WebGL.

E um item que só apareceu agora que os blocos existem:

- [ ] **Sem NENHUM parceiro nem marca, a sequência inteira deveria sair da
      viagem.** Hoje os blocos somem — certo — mas os sete tempos de scroll
      continuam lá, e o visitante rola por mar e nuvem sem conteúdo nenhum.
      Isso é uma mudança de linha do tempo em tempo de execução: `--o-length`
      menor e um remapeamento por partes que pula a faixa 0.494 → 0.928. É a
      última peça, e não é pequena.

## O que o storyboard ainda nao responde

1. **Nada de logo no código.** Respondido em 2026-09-02: as marcas são
   parceiras de verdade, mas quem cadastra é o cliente, pelo admin. Então
   nenhuma logo entra em seed, em `packages/site-content` ou em `public/` —
   os quadros nascem vazios e se enchem pelo admin. **No ar, a seção só aparece
   quando existir pelo menos uma marca cadastrada**; quadro vazio publicado
   parece site inacabado.
2. **Que vídeo toca no bloco do convite?**
3. **O menu do storyboard (Home / Video / About Me / Contact) é rascunho** — o
   site usa Início / Soluções / Segmentos / Sobre nós / Contato. Assumido que o
   do storyboard vale como posição, não como conteúdo.
4. **Sobre o branco, o texto e o menu ficam pretos.** Confirmado pelos quadros;
   é o item de contraste que já estava na spec.
