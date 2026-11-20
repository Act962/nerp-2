# Vitrine como app, opções de exibição, caixa, Astro no carrinho e acompanhamento pelo Órbita — Catálogo online

> Ajustes da vitrine pedidos no teste da venda guiada da Armazém Carvalho.
> Feature: `src/features/storefront` + `src/features/catalogo` + `src/app/(storefront)/[subdomain]` + `src/app/router/catalog`
> Criado em: 2026-10-15 · Atualizado em: 2026-10-15
> Status: 🟡 Em andamento

---

## Situacao atual

No modo Órbita, a página do pedido do nerp (`/pedido/<venda>`) só conhece "recebido" e "pago" (o Órbita só avisa o pagamento), então mostrava "Recebido · Agora" e "Pagar meu pedido" com o valor ainda em aprovação — o WhatsApp andava e a página não. A seção "Navegue por categoria" não podia ser desligada. No celular, a barra inferior da vitrine dividia a tela com a barra do navegador.

---

## Pendencias

### Funcional

- [x] **Acompanhamento pelo Órbita** (`acompanhar-pedido.tsx`) — pedido com `orbitaPortalUrl` leva direto ao acompanhamento do Órbita, que segue a venda guiada (spec 0104, RF-22, no Órbita). — ✅ 2026-10-15
- [x] **"Navegue por categoria" opcional** (`CatalogSettings.showCategoryNav`, padrão ligado; migration `20261015130000_catalog_show_category_nav`) — liga/desliga em Visibilidade; desligado, some a seção e o atalho "Categorias" da barra inferior. — ✅ 2026-10-15
- [x] **Vitrine instalável** (`[subdomain]/app-manifest`) — manifest por loja (nome, logo, cor, `display: standalone`), `appleWebApp` e `themeColor`; instalada, abre em tela cheia sem a barra do navegador. — ✅ 2026-10-15

- [x] **"Mostrar código do produto"** (`CatalogSettings.showProductCode`, padrão desligado; migration `20261015140000_catalog_show_product_code`) — código (SKU) nos cards e na página do produto; desligado, não aparece em lugar nenhum. — ✅ 2026-10-15
- [x] **Caixa no catálogo** (`lib/caixa.ts`) — com "unidades por caixa" (`packQty`) o card mostra "Caixa com 12 un.", e a página do produto e o carrinho convertem a quantidade ("18 un = 1 cx e meia"). — ✅ 2026-10-15
- [x] **Astro monta o pedido** (`server/astro/tools.ts`, `@nerp/astro-widget`) — tools `colocarNoCarrinho` e `finalizarPedido`; o widget repassa `acaoNoCliente` à vitrine (uma vez por chamada) e mostra os botões "Ver meu pedido" / "Finalizar pedido". No modo Órbita, o Astro explica que o último passo é "Enviar pedido pelo WhatsApp". — ✅ 2026-10-15

### UX

- [x] **Convite "Instalar o app"** (`instalar-app.tsx`) — só no celular, 4 s depois de abrir, uma vez por loja; Android abre o instalador do Chrome, iPhone ensina o Compartilhar → Adicionar à Tela de Início. — ✅ 2026-10-15
- [x] **Barra inferior some ao rolar** (`use-esconde-ao-rolar.ts`) — no navegador some ao descer e volta ao subir; instalada (tela cheia) fica fixa. — ✅ 2026-10-15

---

## Decisoes tomadas

- **Uma página de acompanhamento só, a do Órbita** — é quem sabe tudo (valor, aprovação, pagamento, separação, rota); duplicar os estados no nerp exigiria o Órbita avisar cada passo.
- **A barra do navegador não some numa aba comum** — limite do navegador; o caminho é instalar como app. Por isso o convite.
- **`/app-manifest` sem extensão** — o middleware não reescreve caminhos com extensão, e o modo `/catalogo/<slug>` precisa da reescrita; `start_url`/`scope` relativos servem aos dois modos.

---

## Melhorias futuras (nao urgentes)

- [ ] Ícones do app em PNG quadrado gerados da logo (hoje a logo vai como está; logo não quadrada aparece com borda).
