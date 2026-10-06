# Jornada do Ecossistema — a cena de `/solucoes`

> A aba "Ver todas as soluções" deixa de ser uma grade de cards e passa a ser uma
> jornada guiada: o lead entra pela atração, atravessa as órbitas e chega ao
> STAR FRIENDS. A lista completa continua existindo, abaixo da cena.
> App: `apps/site` (serve o orbitatec.com.br) · Rota: `/solucoes`
> Criado em: 2026-10-06 · Atualizado em: 2026-10-06
> Status: 🟡 Em andamento

---

## Situacao atual

`/solucoes` renderiza só o `SectionIndexPage`: a abertura, os grupos vindos do
`SiteContent` e uma grade de cards com as 28 ferramentas. É correto para busca e
ligação interna, mas não conta a história — o visitante vê um catálogo, não um
ecossistema, e nada explica em que momento da operação cada solução entra.

O menu já chama essa página de "Ver todas as soluções →"
(`orbita/ui/mega-menu.tsx`), e é a ela que o time comercial recorre numa
apresentação. Hoje ela não sustenta essa conversa.

Arquivos principais:
- `apps/site/src/app/solucoes/page.tsx` — a rota
- `apps/site/src/features/section-index.tsx` — a grade atual (continua)
- `packages/site-content/src/catalog.ts` — `RAW_TOOLS` (28), `MENU_COLUMNS`, `CATEGORIES`
- `packages/site-content/src/metodo.ts` — `METODO_ETAPAS`, `METODO_PRINCIPIO`
- `apps/site/src/orbita/scene/` — a cena 3D da home (R3F), referência de padrão
- `apps/site/public/astro/camadas/` — o personagem ASTRO em camadas + `manifesto.json`
- `apps/site/public/orbita/nave.webp` — a nave

---

## O conceito

Três papéis, que o visitante precisa entender nesta ordem:

| Elemento | Papel | De onde vem |
|---|---|---|
| **Nave N.A.S.A** | A metodologia que **conduz** a operação | `metodo.ts` — Necessidade, Análise, Sistematização, Ação |
| **ASTRO** | A inteligência que **guia**: acompanha, orienta e age | Personagem oficial (`manifesto.json`); specs 0029/0050 do `nasaex-wey` |
| **STAR FRIENDS** | O **destino**: fidelização e relacionamento de longo prazo | `docs/star-friends.md` do `nasaex-wey` |

E cinco órbitas, da mais distante (entrada) à mais próxima (retenção):

| # | Órbita | Subtítulo | Soluções |
|---|---|---|---|
| 1 | Atração | Entrada do funil | TrafeGO, Pages, Linnker, Comments, Disparo, Forms |
| 2 | Atendimento | Qualificação e relacionamento inicial | Chat, Agendas, Catálogo Promocional, Catálogo Online |
| 3 | Operação comercial | Gestão do processo | CRM Tracking, NERP, Workspaces |
| 4 | Entrega | Execução, acompanhamento e inteligência | Payment, Forge, Book de Execução, Insights, Route |
| 5 | Retenção | Relacionamento contínuo | STAR FRIENDS (o centro) |

Entre as órbitas flutuam **asteroides**: as dores da operação (lead esquecido,
planilha paralela, processo que morre entre setores, inadimplência, retrabalho,
agenda sem confirmação, verba sem comprovação, ruptura de estoque, decisão no
feeling, cliente sem histórico).

---

## Pendencias

### Critico

- [x] **Insights não existe no catálogo** — ✅ 2026-10-06 — (`packages/site-content/src/catalog.ts`) —
  um dos apps mais ricos do produto (funil, canal de aquisição, performance por
  atendente, jornada do lead, resgate de leads frios, dashboard público, tráfego
  pago unificado) não tem entrada no site. Sem ele a órbita 4 fica incompleta.
- [x] **STAR FRIENDS não existe no catálogo** — ✅ 2026-10-06 — (idem) — é o destino da jornada e
  não tem nem card nem página. Programa de fidelidade real: ⭐ por compra, níveis
  Terra/Lua/Galaxy, prêmios e resgates por quatro canais.
- [x] **O agrupamento por órbita não existe como dado** — ✅ 2026-10-06 (`packages/site-content/src/jornada.ts`) — — `CATEGORIES` agrupa por
  natureza (comercial, gestão, marketing, plataforma, loja), não por momento da
  jornada. A cena precisa de `ORBITAS`, uma leitura nova do mesmo catálogo.

### Funcional

- [x] **A cena** (`apps/site/src/features/jornada/`) — ✅ 2026-10-06 — — R3F, cinco anéis elípticos,
  planetas texturizados, asteroides, ASTRO e nave. Pausa a rotação quando o cursor
  se move; hover acende as ligações da solução e abre o cartão.
- [x] **A jornada guiada** — ✅ 2026-10-06 — hero → nave → ASTRO → órbitas 1 a 5 →
  mapa completo → CTA. A câmera conduz, a órbita do passo acende e as outras
  apagam, e a régua permite saltar para qualquer passo.
- [x] **A página** (`apps/site/src/app/solucoes/page.tsx`) — ✅ 2026-10-06 — — jornada em cima, a
  grade do `SectionIndexPage` abaixo, sem perder o JSON-LD nem a trilha.

### UX

- [ ] **Rótulos que não se cruzam** — a projeção comprime os topos das elipses; os
  rótulos de órbita e de planeta precisam se afastar sozinhos.
- [ ] **`prefers-reduced-motion`** — sem rotação nem câmera conduzida; a cena vira
  o mapa completo, parado. Mesma regra do RNF-2 da spec 0053 do `nasaex-wey`.
- [ ] **Celular** — a cena 3D não se sustenta em tela estreita. Cair para uma
  versão em lista por órbita, mantendo a narrativa.

### Qualidade de codigo

- [ ] **Não duplicar o catálogo** — a cena lê de `@nerp/site-content`; nenhum nome
  ou descrição de solução escrito dentro do componente.

---

## Decisoes tomadas

- **A órbita externa copia a fileira de cartões** (2026-10-06) — mesma largura
  (`LARGURA_CADEIA`, 1180px) e bordas na mesma linha. A câmera não tem distância
  fixa: `Conducao` mede a elipse projetada e ajusta até bater, em qualquer tela.
- **A órbita fica centrada no espaço livre** — o palco ocupa exatamente o que
  sobra da janela abaixo dos cartões (e do método, no primeiro passo), e a
  câmera centra a elipse no canvas. Quando o método some, a órbita desce sozinha
  para o novo meio.
- **Um enquadramento só; sem zoom por etapa** — com o zoom, a órbita externa
  saía da tela a partir do terceiro passo e a regra acima deixava de valer. Quem
  diferencia as etapas é o realce: a órbita ativa acende, as outras apagam.
- **A navegação é a cadeia de cartões, travada em sequência** — Iniciar, depois
  uma etapa por vez; voltar é livre, pular à frente não. O painel lateral saiu.
- **O método N.A.S.A só aparece no passo Iniciar**, logo abaixo dos cartões, com
  a marca no lugar do título (`public/orbita/nasa-logo.webp`, toda branca).
- **Saíram da cena**: a nave, o personagem do Astro, os asteroides, a estrela e
  o halo do centro, a trilha de navegação e a grade de cards da página.
- **O centro é a etapa "Retenção"**, e a órbita 5 tem Star Friends, Gatilhos e
  Astro. Gatilhos entrou no catálogo (31 ferramentas).
- **O corpo do centro é o ASTRO da Início da plataforma** (2026-10-06) — o mesmo
  disco azul com arco, lua e olhos que seguem o cursor, no lugar e no tamanho do
  planeta que havia ali, sem os satélites e sem o botão "+". É um disco DENTRO
  da cena (canvas pintado a cada quadro), não HTML por cima: os planetas da
  órbita 5 cruzam na frente e atrás dele. O nome "Retenção" desceu para logo
  abaixo do disco, para não tapar o rosto.
- **"Ver todas as soluções" recolhe o painel em cortina** (2026-10-06) — o painel
  azul sobe e descobre a jornada. Já em `/solucoes` ele sobe no clique (antes o
  link não fazia nada: o painel só fechava em troca de rota). Vindo de outra
  página, o painel da página nova nasce coberto, espera a cena avisar que está
  desenhada (`CENA_PRONTA`, em `orbita/lib/cortina.ts`) e então sobe.
- **O método N.A.S.A só abre com o clique em "Iniciar"** (2026-10-06) — a chegada
  é a cena limpa. O primeiro clique em "Iniciar" (ou no "Próximo" dele) mostra o
  bloco e destrava "Atração"; qualquer outra etapa o fecha.
- **"Reiniciar" no fim** — no passo "Ver tudo", o botão do último cartão vira
  "Reiniciar": volta ao começo com as etapas travadas e os traços recolhidos.
- **Cartões vivos, céu que acompanha** — os cartões flutuam defasados, têm brilho
  leve e uma luz que percorre o contorno (parada nos travados). Estrelas e
  nebulosas giram de leve contra o cursor, em tantos diferentes; os planetas
  não, porque são o alvo do clique.
- **Etapa que abre, planetas que crescem** (2026-10-06) — os planetas da etapa
  aberta saltam para 1,4× em mola, um após o outro, e voltam ao tamanho de
  sempre quando a etapa fica para trás. O traço e o crescimento acompanham o
  botão que acende: por isso a órbita de Atração já aparece no clique em
  "Iniciar", junto com o método, antes de virar o passo.
- **O ASTRO do centro é uma esfera com superfície e sombra** (2026-10-06) — só
  nesta página. Mesma luz dos planetas (lado claro, lado escuro), textura nos
  azuis da marca e o rosto projetado de frente, sem distorcer. Na plataforma e
  no widget ele continua o disco chapado.
- **`.jor__ficha` ≠ `.jor__cartao`** — a ficha do planeta e os cartões das etapas
  já dividiram o mesmo nome de classe, e os botões herdavam 28px de deslocamento.

- **O cabeçalho mora no `SectionIndexPage`** — pôr a jornada por fora dele
  empurrava o menu para baixo da cena. Por isso existe o encaixe
  `antesDaAbertura`, entre a trilha e a abertura do trecho: a navegação fica no
  topo e o conteúdo entra onde deve. Serve a qualquer outro trecho que precise.

- **A jornada vem primeiro, a lista fica abaixo** — decisão do Weydson
  (2026-10-06). A grade ainda serve para quem já sabe o nome da ferramenta, e é
  ela que distribui link interno para as 28 páginas de produto.
- **`orbitStation: false` para Insights e STAR FRIENDS** — a cena da home deriva a
  geometria da CONTAGEM de estações (hoje 19). Entrar como estação apertaria os
  rótulos de todas. Eles entram no menu e ganham página própria; a cena da home
  fica como está.
- **O ASTRO é o personagem oficial, não um astronauta de traje** — a referência
  visual trazida mostrava um astronauta de capacete; o ASTRO do produto é a esfera
  azul com rosto (`globo` + olhos + boca). Identidade não se inventa.
- **Satélite ≠ solução** — no produto, satélites são as **integrações** que orbitam
  o ASTRO (spec 0053 do `nasaex-wey`). Nesta cena as soluções são planetas; a
  palavra "satélite" fica reservada ao seu significado real.
- **O mapa não é editável pelo admin** — como as estações da home, a jornada é a
  própria cena. O admin edita o menu e as páginas de produto, não as órbitas.

---

## Proximos passos

1. ~~Catálogo~~ e ~~cena~~ entregues em 2026-10-06.
2. Rótulos que não se cruzam: hoje o nome da órbita ainda encosta no destino e
   em alguns planetas. Falta afastar também contra os corpos, não só entre si.
3. ~~Jornada guiada~~ entregue em 2026-10-06. Falta a área de clique dos
   planetas: hoje é do tamanho do desenho (~20px), e errar o alvo numa
   apresentação é constrangedor. Resolver com esfera invisível maior.
4. Celular: hoje cai na lista (`env.compact`). Decidir se ganha uma cena
   simplificada ou se a lista basta.

---

## Melhorias futuras (nao urgentes)

- [ ] As 10 soluções fora da narrativa (PDV, Estoque, Inventário, QR Preço,
  Planograma, TradeGram, Book, Space Station, Planner, N-box, Ranking) aparecerem
  no "mapa completo" do último passo, sem poluir as cinco órbitas.
- [ ] "Falar com o ASTRO" abrindo o widget já com o contexto da órbita em que o
  visitante estava.
- [ ] Trilha sonora curta no passo final, com controle de mudo.
