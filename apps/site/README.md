# @nerp/site — o site institucional da ÓRBITA HUB

Um app Next próprio, ao lado do `apps/web`. Serve a home (a experiência 3D
controlada por scroll) e as páginas internas das soluções, em `/solucoes/<slug>`.

## Por que é um app separado

Porque o que ele faz é diferente do que o ERP faz. O ERP é uma aplicação
autenticada, pesada, com 136 models e um build que já briga com memória. O site
é uma vitrine: precisa ser rápido, ser indexado e ficar de pé sozinho.

A divisão é a mesma que o `apps/desktop` já usa:

- **`apps/web` é dono do estado.** Banco, better-auth, R2 e o admin do site (em
  `/site`) moram lá. É lá que o conteúdo é editado.
- **`apps/site` é dono do desenho.** Não tem Prisma, não tem better-auth, não
  tem storage. Pede o conteúdo publicado por HTTP e monta a página.

O contrato entre os dois é o pacote `@nerp/site-content`, que não pertence a
nenhum dos lados.

## A regra que sustenta tudo

**O site não cai porque o ERP caiu.** Qualquer falha ao buscar o conteúdo —
rede, 503, JSON torto, tabela ainda não migrada — volta para `DEFAULT_CONTENT`
(`src/orbita/data/content.ts`), que é o catálogo que mora aqui dentro. O
visitante vê o site de sempre; o que se perde é só a edição feita no admin.

O mesmo vale painel a painel: painel que volta vazio cai no padrão, painel com
itens manda. Isso é o que permite subir este app antes de existir uma linha no
banco.

## Como falam

```
GET {NEXT_PUBLIC_APP_URL}/api/site/content       → menu, números, contato
GET {NEXT_PUBLIC_APP_URL}/api/site/page/<slug>   → os blocos publicados
GET {NEXT_PUBLIC_APP_URL}/api/site/partners      → parceiros e marcas
GET {NEXT_PUBLIC_APP_URL}/api/site/pages         → os endereços publicados, para o sitemap
```

E uma no sentido contrário, que não é conteúdo: `POST /api/astro/chat`, aqui
neste app, faz proxy da conversa com o consultor para o `apps/web` — same-origin
para o navegador, com o segredo no servidor. Ver `app/api/astro/chat/route.ts`.

As duas são abertas: devolvem exatamente o que qualquer visitante veria. Nada
de rascunho, nada de quem editou, nada de acesso. A busca acontece **no
servidor** — o menu precisa estar no HTML que chega, para quem lê e para quem
indexa — com 60s de cache dos dois lados e 4s de timeout, porque uma home lenta
é pior do que um menu de ontem.

## O que o admin controla, e o que não controla

Controla os painéis da barra, as páginas internas, as imagens, os números e o
contato.

Não controla as 19 estações da órbita: elas saem de `src/orbita/data/catalog.ts`
porque *são* a cena 3D — ângulo, foco de câmera e roleta nascem dali em tempo de
módulo. Um item de menu sem estação correspondente vira texto simples, em vez de
um botão que não leva a lugar nenhum.

O detalhe do funcionamento da cena está em `src/orbita/README.md`.

## Rodando

```
pnpm install
pnpm --filter @nerp/site dev      # http://localhost:3001
```

Precisa do `apps/web` no ar em `NEXT_PUBLIC_APP_URL` para ver o conteúdo do
banco — sem ele, o site sobe do mesmo jeito, com o conteúdo padrão.

### Variáveis

| variável | para quê |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | onde está o `apps/web` (conteúdo, login, cadastro) |
| `NEXT_PUBLIC_SITE_URL` | **o endereço público deste site** — base de canonical, `og:url`, cartões e sitemap |
| `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` | host público do bucket de imagens |
| `SITE_ASTRO_TOKEN` | o segredo do proxy do consultor; tem de casar com o do `apps/web` |

`NEXT_PUBLIC_SITE_URL` é a que dói se ficar de fora: sem ela todo canonical e
todo `og:url` saem apontando para `localhost:3001`, e o Google descarta a
página por apontar para um endereço que ele não alcança. Não há como o código
adivinhar isto — é a única coisa que só o deploy sabe.

`SITE_ASTRO_TOKEN` dói de outro jeito: a rota de chat do `apps/web` deixa
passar quando não há segredo definido (para o dev funcionar sem configuração),
então esquecer a variável nos dois lados publica uma rota de LLM aberta.

## SEO

O site existe para ser achado, então a camada de SEO é parte da estrutura e não
um acréscimo. O que vale saber para não desfazer sem querer:

- **`lib/seo.ts` é o único lugar** onde se decide título, descrição, canonical,
  Open Graph e JSON-LD. As rotas chamam `metadataDaPagina()`; nenhuma escreve
  `<meta>` por conta própria. É o que impede as quatro de divergirem.
- **A descrição pode não ser o campo de SEO.** As páginas que nascem do código
  trazem taglines de 20 a 50 caracteres em `seoDescription` — curto demais, o
  buscador descarta e monta a dele. Quando o campo é curto, `descricaoDaPagina()`
  usa o parágrafo do herói, que é texto visível e escrito por gente. Nada é
  gerado; escolhe-se entre dois textos que já existem.
- **`/og` desenha o cartão de compartilhamento** quando o admin não subiu
  imagem. Ele NÃO fica sob `/api` de propósito: o `robots.txt` bloqueia aquele
  prefixo e o rastreador do Facebook e do X respeita robots ao buscar imagem —
  o cartão apareceria vazio.
- **O sitemap é a união de duas listas**: as 40 páginas que nascem do código
  (todas respondem 200, mesmo com o `apps/web` fora do ar) e as publicadas no
  admin, que vêm de `/api/site/pages`. Sem a segunda, a página que o cliente
  cria nunca entraria no arquivo.
- **`/solucoes`, `/segmentos` e `/sobre` são páginas de trecho**, e existem
  tanto para o visitante quanto para a hierarquia: sem elas a trilha
  "Início › Soluções › Chat" apontaria para um endereço que não existe. Elas
  não têm conteúdo próprio — a lista é a mesma do painel da barra.

O que o rastreador recebe da home é a versão **sem WebGL** (`orbita/fallback/`):
a cena 3D só assume depois que o navegador confirma que tem WebGL, e essa
checagem não existe no servidor. Na prática o HTML da home é o catálogo inteiro
em texto, com um H1 e um link para cada página interna — que é o melhor
resultado possível, e acontece de graça por causa de como o fallback foi feito.
