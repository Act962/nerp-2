# ÓRBITA HUB — experiência 3D controlada por scroll

Esta pasta é a experiência 3D da ÓRBITA HUB, renderizada na home (`/`) do
`apps/site`.
Ela é autocontida: só depende de `three`, `@react-three/fiber`, `gsap` e
`lenis`, e traz o próprio CSS — o design system do ERP não entra aqui e nada
daqui vaza para o resto do projeto. Não há import com `@/`, não há Tailwind.

## A ideia

O scroll não rola uma página: ele conduz uma órbita. A câmera, a escala do
planeta, a posição da esfera branca na trajetória e a entrada de cada bloco de
texto saem todos do mesmo valor — a posição normalizada do scroll. Por isso o
movimento é contínuo em vez de uma sequência de seções que aparecem.

Três decisões sustentam isso:

1. **Estado a 60fps fora do React.** O objeto `scroll` (`lib/store.ts`) é lido
   dentro de `useFrame` e de loops de `requestAnimationFrame`. Só valores
   discretos — qual produto está aberto — passam pelo React, via
   `useSyncExternalStore`. Nenhum re-render por frame.
2. **Uma única passada de revelação.** `lib/reveal.ts` mantém um registro plano
   de elementos e escreve `style` direto, uma vez por frame. Não há um
   ScrollTrigger por elemento.
3. **Ancoragem DOM↔3D.** `scene/tracker.tsx` projeta pontos do mundo para
   pixels a cada frame, testa oclusão pela esfera do planeta de forma analítica
   e prende o elemento na viewport. É o que faz um rótulo HTML — nítido e
   selecionável — se comportar como se estivesse na cena.

## O que tem dentro

```
data/catalog.ts        as 28 ferramentas da suíte (19 delas, estações da órbita)
data/site.ts           marca, navegação, rodapé
lib/                   store, órbita, revelação, qualidade, assets
scene/                 planeta, atmosfera, estrelas, órbita, nós, esfera, device
ui/                    navegação, blocos de texto, intro, modo produto, rodapé
fallback/              a mesma narrativa sem WebGL
hooks/                 a linha do tempo do scroll
```

### O catálogo

`data/catalog.ts` é a fonte de verdade do conteúdo. Saiu de
`specs/site-orbitatec/05-operacoes.md` e `06-briefing-imagens.md` — nada foi
inventado, e as restrições de veracidade do próprio spec estão anotadas no
cabeçalho do arquivo (Disparo não vende disparo em massa, nenhuma integração
não implementada é citada, e por aí).

Cada ferramenta é uma esfera na órbita. Cada funcionalidade é uma sub-esfera
da roleta que aparece quando a ferramenta abre.

### Os painéis da barra

"Soluções", "Segmentos" e "Sobre nós" abrem um painel que desce da barra e
ocupa a largura toda. Os cantos de baixo são arredondados porque o painel é um bloco pendurado
na barra, não uma segunda faixa colada nela.

O painel é claro: o fundo é `#3db4ff`, exatamente o azul do sublinhado dos
itens do menu, e enquanto ele está aberto a barra assume a mesma cor. Ícones,
títulos de coluna e o sublinhado ficam brancos; os nomes das ferramentas e as
descrições ficam em azul-escuro, que é o que se lê sobre esse fundo. As três
variáveis (`--o-mega-bg`, `--o-mega-ink`, `--o-mega-soft`) moram na raiz do
CSS porque a barra também as usa.

O logotipo oficial é branco e sumiria sobre o azul; com o painel aberto ele
recebe um filtro que o escurece. É tratamento de cor do mesmo arquivo — nada
foi redesenhado.

**Soluções** lista as 28 ferramentas em seis colunas, uma por momento do
negócio, com um ícone cada (`ui/icons.tsx`, desenhos em SVG, sem fonte de
ícones), uma busca no topo que filtra por nome e descrição, e o Método N.A.S.A.
fechando o painel — ele não é ferramenta, é o que orquestra as outras.

O menu e a cena leem o mesmo catálogo de dois jeitos: `TOOLS_BY_COLUMN` para o
painel, `ORBIT_TOOLS` para a órbita. Os módulos do NERP (PDV, estoque,
inventário, catálogos, QR Preço, planograma, book) entram no menu com
`orbitStation: false` — a geometria da cena sai da CONTAGEM de estações, e 28
esferas apertariam os rótulos a ponto de nenhum ficar legível.
**Segmentos** lista os seis setores em cards — cada um com a sua cor, sobre
fundo claro, porque as cores da marca foram feitas para fundo neutro e sobre o
azul do painel brigariam entre si.

**Sobre nós** traz duas listas curtas (Institucional e Parcerias) e um bloco
em destaque para Treinamentos. O destaque não é decoração: Treinamentos não
tem sub-itens, e como terceira coluna o título repetiria o próprio link logo
abaixo dele.

O destino de cada item sai de um mapa por painel — `TOOL_LINKS` em
`data/catalog.ts`, `SEGMENT_LINKS` em `data/segments.ts`, `ABOUT_LINKS` em
`data/about.ts`. A regra é a mesma:

- **com URL** → o item é um `<a>` de verdade. `http…` abre em aba nova; `/…`
  navega dentro do site.
- **sem URL** → a ferramenta leva à sua estação na órbita e abre o modo
  produto; segmentos e itens de "Sobre nós" levam ao WhatsApp comercial.

As páginas internas podem nascer uma a uma: enquanto a de uma ferramenta não
existir, o menu continua levando a algum lugar que existe. Basta descomentar a
linha e trocar pelo endereço real.

Comportamento: fecha por `Esc`, por clique fora e pelo próprio botão; aberto
pelo teclado, o foco entra no primeiro item e volta ao gatilho ao fechar;
aberto pelo mouse, o foco fica onde está. Em telas médias vira duas colunas
(três cards de segmento), e no celular vira uma folha rolável com barra de
fechar — coluna única e dois cards por linha.

### Contato

`WHATSAPP`, em `data/site.ts`, é o número comercial. Ele alimenta três lugares:
o botão flutuante no canto inferior direito (`ui/whatsapp.tsx`), o
"Agendar Demonstração" da barra e os CTAs dos painéis.

O botão flutuante escreve a própria opacidade no loop, não pelo React: ela
acompanha `scroll.intro` — antes da cortina subir não há o que perguntar — e
zera quando `scroll.menuOpen` está ligado, porque com a folha aberta no celular
ele só cobriria a lista.

### Retrato

Duas decisões de câmera valem só no celular, em `scene/camera-rig.tsx`:

- **o globo fica no eixo.** O desvio lateral que no desktop abre o terço
  esquerdo para o texto zera (`centering`), em X e em Z — zerar só o X ainda
  deixava o planeta fora do eixo no herói, onde ele é maior.
- **o globo sobe meio diâmetro.** Não por inclinar a câmera, que giraria a
  cena inteira, mas por um deslocamento de frustum (`setViewOffset`) do
  tamanho do raio do planeta projetado. A base do globo pousa na metade da
  tela e a metade de baixo fica para o texto. O deslocamento se desfaz quando
  um produto abre, que tem enquadramento próprio.

E uma de leitura, em `scene/tool-nodes.tsx`: em telas estreitas a janela de
foco encolhe de `0.42` para `0.14` rad, então só o rótulo da ferramenta em
foco aparece. Com a janela larga, quatro placas se empilhavam em 390px e
nenhuma ficava legível.

### Favicon

`src/app/(home)/icon.png` — o símbolo oficial sobre o azul-escuro da marca. O
símbolo é arco azul com esfera branca: sobre azul o arco some, sobre branco a
esfera some, e o fundo escuro segura os dois. Está no diretório da home, e não
na raiz do app, para não trocar o ícone do ERP inteiro.

### O modo produto

Clicar numa esfera (ou no rótulo dela) chama `openProduct`. A partir daí:

- a câmera vai até o nó (`scene/camera-rig.tsx`);
- a esfera branca sai da trajetória e pousa sobre ele, crescendo
  (`scene/orbit-object.tsx`);
- o planeta abaixa a luz, mas continua atrás (`dim` no shader);
- os outros 18 nós desaparecem;
- um notebook e um celular flutuam à frente, com a tela desenhada em canvas —
  um leiaute por funcionalidade (`scene/device-mockup.tsx`);
- o scroll passa a girar a roleta em vez de rolar a página
  (`hooks/use-scroll-timeline.ts`).

`Esc`, o botão "Voltar à órbita" ou um clique na área da esfera desfazem tudo
pelo mesmo caminho.

### Sem WebGL

`fallback/` renderiza a mesma narrativa em CSS, com o catálogo inteiro em
texto. Vale também para `prefers-reduced-motion`. A cena 3D é carregada com
`React.lazy`, então quem cai no fallback nunca baixa o three.js.

### Assets

Texturas e imagens da marca vivem em `public/orbita/`, na raiz deste app. `lib/assets.ts` resolve
cada caminho por um mapa opcional em `window.__ORBITA_TEXTURES__` — é o que
permite servir a mesma cena de um HTML único, com tudo embutido, sem tocar em
nenhum componente.

As imagens da marca são os arquivos oficiais entregues pela ÓRBITA, apenas
convertidos para WebP. Nada foi redesenhado: as proporções em `ui/brand.ts`
foram medidas no próprio arquivo do símbolo.

## O admin

O admin fica no `apps/web`, em `/site` — é lá que o conteúdo é editado. O que ele controla:

- **os painéis da barra** — nome, coluna, descrição, ícone, ordem, destino e se
  aparece. Painel sem nenhuma linha no banco cai no conteúdo que vem no código
  (`data/content.ts`), então o site nunca fica em branco;
- **as páginas internas** — `/solucoes/<slug>`, montadas com oito blocos que se
  ligam, desligam e reordenam. Rascunho e publicado são separados: uma página
  meio editada não aparece para o visitante;
- **as imagens** — vão para o mesmo bucket que o resto do nerp usa;
- **os números e o contato** — inclusive os quatro números de exemplo listados
  abaixo, que o painel do admin marca como pendência enquanto forem os de
  exemplo.

O conteúdo chega à cena por `lib/content-context.tsx`, alimentado pelo servidor
em `app/page.tsx`, que busca em `/api/site/content` do `apps/web`. O fallback sem WebGL lê o mesmo contexto — quem entra sem
WebGL vê o menu publicado, não uma cópia congelada dele.

O que o admin **não** controla são as 19 estações da órbita: elas saem de
`data/catalog.ts` porque são a própria cena — ângulo, foco de câmera e roleta
nascem dali em tempo de módulo. Um item de menu sem estação correspondente vira
texto simples em vez de um botão que não leva a lugar nenhum.

## Pendências conhecidas

- `STATS`, em `data/site.ts`, são números de placeholder — agora editáveis no
  admin, mas ainda inventados até alguém trocar.
- O e-mail e o telefone do rodapé também são placeholders, na mesma tela.
- As páginas internas ainda não existem: `TOOL_LINKS`, `SEGMENT_LINKS` e
  `ABOUT_LINKS` estão prontos para recebê-las. `treinamentos` pode apontar
  para o Route, que já é "cursos e área de membros" da suíte.
- Os textos de apoio do painel "Sobre nós" são de redação, não de spec.
- As telas do notebook são desenhadas em código. Quando houver prints reais,
  basta trocar a `CanvasTexture` por uma `TextureLoader` em
  `scene/device-mockup.tsx` — o resto da cena não muda.
