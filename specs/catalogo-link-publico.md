# Catálogo Promocional: link público + WhatsApp com link

> No "Compartilhar", além de exportar imagem/PDF, permitir **gerar um link
> público** do catálogo (uma página web read-only, estilo Canva "publicar"), e
> usar esse link no envio por **WhatsApp** (mensagem com o link clicável).
>
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog` + rota pública
> Branch alvo: `feat/catalogo-link-publico` (nova)
> Criado em: 2026-08-21
> Status: 🟢 Entregue (link público + WhatsApp com link). Melhorias abaixo.

---

## Entregue — link público (sem migration)

- **Token no `config`** (JSON) — sem migration. O update do catálogo faz merge,
  então o autosave NÃO apaga o token. Procedures:
  `promotionalCatalog.enableShare` / `disableShare` (auth+org) e
  `promotionalCatalog.publicGet` (bare `base`, por token, resolve produtos server-side).
- **Resolver compartilhado** `server/resolve-products.ts` (usado por `listProducts` e `publicGet`).
- **Distribuição pura** `lib/layout.ts` (`distributePages`/`finalizeProducts`/`effectivePageConfig`)
  — espelha o editor; usada no render público. MANTER EM SINCRONIA com `catalog-editor.tsx`.
- **Rota pública** `src/app/(public)/promocao/[shareToken]/page.tsx` (server, busca in-process
  via `client`, `notFound()` se o token não existe) + `components/public-promo-catalog.tsx`
  (render read-only reusando `CatalogPreview` por página). `/promocao` no allowlist do middleware.
- **ShareDialog**: "Criar link do catálogo" → mostra a URL com Copiar, **Enviar link no
  WhatsApp** (mensagem com link) e Desativar.
- Fotos: o proxy `/api/s3/image` é público, então resolvem na página pública.

---

## Entregue antes (mesma sessão)

- **Escolher qual página compartilhar** no diálogo "Compartilhar" (`share-dialog.tsx`):
  `Select` de páginas; as ações (Compartilhar/WhatsApp/Instagram/Copiar) capturam a
  página escolhida (`capturePage(index)` via `allPageRefs`), começando na página em foco.
- **WhatsApp** já envia a IMAGEM da página escolhida (bandeja no celular; no desktop
  baixa + abre o WhatsApp Web) — mesma limitação do Canva na web.

---

## Planejado

### 1. Link público do catálogo

- **Schema**: `PromotionalCatalog` ganha `shareToken String? @unique` (+ talvez
  `isPublic Boolean @default(false)`). **Migration aditiva** (cuidado com o drift
  do Neon compartilhado — usar migration manual + `migrate deploy`, ver memórias).
- **Procedures** (`router/promotional-catalog/`):
  - `enable-share` (auth+org): gera/retorna `shareToken` do catálogo (multi-tenant).
  - `disable-share` (auth+org): limpa o token.
  - `public-get` (bare `base`, SEM auth): recebe `shareToken`, devolve `{ name, config }`
    (sem dados sensíveis) para renderizar. Igual ao padrão de `catalog/public.ts`.
- **Rota pública**: `src/app/(public)/catalogo/[shareToken]/page.tsx` — renderiza o
  catálogo read-only reusando `CatalogPreview` por página (sem `SelectionLayer`/painéis),
  com navegação entre páginas. As fotos precisam resolver (proxy/же data URL) fora do editor.
- **UI**: no `ShareDialog`, botão **"Criar link do catálogo"** → chama `enable-share`,
  mostra a URL (`/catalogo/<token>`) com "Copiar link" e um toggle "Link ativo".

### 2. WhatsApp com o link

- Quando houver link, o botão WhatsApp manda a **mensagem com o link** (`wa.me?text=`),
  além de (ou em vez de) a imagem. Link clicável abre a página pública.

## Critérios de aceite (MVP)

- [ ] "Criar link do catálogo" gera uma URL pública estável e copiável.
- [ ] A URL abre uma página read-only com todas as páginas do catálogo (deslogado).
- [ ] Possível desativar o link (token some / 404).
- [ ] WhatsApp pode enviar o link (mensagem) além da imagem.
- [ ] Multi-tenant: `public-get` só resolve pelo token, sem vazar outros dados.
- [ ] `biome` + `tsc` limpos; migration aplicada sem quebrar o build.

## Riscos / notas

- Migration no Neon compartilhado (drift) — aplicar manual + `migrate deploy`.
- Render público das FOTOS (hoje o editor embute data URLs); a página pública precisa
  servir as imagens (proxy same-origin) para não quebrar CORS.
- `config` pode conter `cardLayoutOverrides`/`styleBlocks`/`productGroups` novos —
  a página pública reusa o mesmo `CatalogPreview`, então já cobre.
