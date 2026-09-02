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
```

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
| `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` | host público do bucket de imagens |
