# Catálogo online — personalização de cores, produtos 1:1 e o Astro na vitrine

> Seletor de cor livre (tema + fundo) na Personalização do catálogo, imagens de
> produto em 1:1 na vitrine, e o Astro atendendo o visitante da loja com as
> informações da organização — cobrado em ★ da conta dela.
> Feature: `src/features/catalogo` + `src/features/storefront` + `src/app/router/catalog` + `src/app/(storefront)/[subdomain]`
> Criado em: 2026-09-23 · Atualizado em: 2026-09-23
> Status: 🟡 Em andamento (aguardando teste do dev)

---

## Situação atual

A aba **Personalização** de `/catalogo` oferecia dezoito cores fixas para o tema
e nada para o fundo da página — uma loja com cor de marca fora dessa paleta não
tinha como chegar nela. As imagens de produto usavam `aspect-square` anulado por
uma altura fixa (`h-45`), então a proporção mudava conforme a largura da coluna.
E a vitrine não tinha atendimento nenhum: o visitante com dúvida saía da loja.

Arquivos principais:
- `src/features/catalogo/components/tab-customization.tsx` — a aba
- `src/features/catalogo/components/color-picker.tsx` — o seletor (novo)
- `src/features/storefront/lib/cores.ts` — contraste e defaults (novo)
- `src/features/storefront/server/astro/` — contexto da loja e tools (novo)
- `src/app/api/catalogo/[subdomain]/astro/chat/route.ts` — a conversa (novo)
- `src/app/router/catalog/{update,public}.ts` — os campos novos
- `prisma/schema.prisma` — `CatalogSettings.backgroundColor`, `CatalogSettings.astroEnabled`, `SiteChatChannel.CATALOGO`

---

## O que entrou

### Cores

- [x] **Seletor livre** — roda HSV (`SketchPicker`), campo hexadecimal com
  rascunho local, conta-gotas do navegador (só onde a API `EyeDropper` existe) e
  as amostras antigas como atalho.
- [x] **Cor de fundo da página** (`backgroundColor`) — nasce nula, e nula é "o
  neutro de sempre". Aplicada no leiaute da vitrine junto com `--background` e
  `--foreground`, senão um fundo escuro ficaria com texto preto.
- [x] **Prévia** — fundo e tema só se julgam juntos; o painel mostra os dois num
  cartão de produto de mentira, com aviso quando o fundo é escuro.

### Produtos 1:1

- [x] Grade do catálogo (a altura fixa saiu) e a imagem principal da página de
  produto; as miniaturas e os relacionados foram junto.

### Astro na vitrine

- [x] **Escopo `catalogo`** no prompt do consultor: persona de atendente da
  loja, sem o índice de ferramentas da ÓRBITA — quem está na loja quer comprar,
  não ouvir sobre ERP.
- [x] **Treinado com o que a org cadastrou**: nome, texto do "Sobre",
  categorias, formas de pagamento e entrega, frete, endereço e contatos entram
  no prompt; o catálogo em si sai por tool (`buscarProdutos`,
  `detalharProduto`, `listarCategorias`), com `organizationId` em closure.
- [x] **Cobrança em ★** da organização dona do catálogo, pela ação
  `astro_tokens_1k` (a mesma do Astro interno). Sem saldo para um bloco, a
  mensagem nem começa (402) e o visitante vê um convite para o WhatsApp.
- [x] **Travas**: as do consultor (por sessão e por IP) mais o interruptor
  `astroEnabled` na Personalização.

---

## Decisões tomadas

- **Uma chave de cobrança só (`astro_tokens_1k`)** — sem chave separada para a
  vitrine. O extrato mistura o consumo do app e o da loja; separar é uma
  migração de regra, e só vale quando alguém precisar precificar diferente.
- **`SiteChatChannel.CATALOGO`** — as `site_*` são globais, mas
  `organizationId` já existe na tabela para o canal `APP`. Aqui ele aponta para
  a loja dona da vitrine: é a conta dela que paga.
- **O subdomínio vem do CAMINHO da rota**, nunca do corpo — tenant escolhido
  pelo corpo é tenant escolhido pelo cliente.
- **Fundo nulo = neutro** — um default de cor na migração repintaria todas as
  lojas de uma vez.
- **IDOR corrigido de passagem** (`router/catalog/update.ts`): o handler achava
  a configuração só pelo `id` do cliente, sem conferir a organização.

---

## Próximos passos

1. Testar na vitrine de uma loja real: cor de fundo escura, 1:1 com imagem fora
   de proporção, e uma conversa de ponta a ponta com débito de ★.
2. `pnpm db:deploy` antes de subir — a migration é aditiva.

---

## Melhorias futuras (não urgentes)

- O widget do Astro não usa a cor do tema da loja: a paleta dele é do pacote.
- Cor de card/superfície e cor de texto, se o fundo sozinho não bastar.
- Uma tool que monta o carrinho do visitante (ficou fora por pedir confirmação
  a cada ação).
