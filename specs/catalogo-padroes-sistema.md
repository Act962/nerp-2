# Padrões do Sistema — Catálogo Promocional

> Aba "Padrões do Sistema" com 3 sub-abas (Fundo, Grupo de produtos, Etiquetas) que
> salvam aparência + etiquetas + textos/imagens dinâmicas a nível UNIVERSAL. As
> imagens de produto do padrão servem de INSPIRAÇÃO (não são gravadas no banco de
> quem aplica).
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog`
> Criado em: 2026-08-23 · Atualizado em: 2026-08-23
> Status: 🟡 Em andamento (1ª entrega)

> ⚠️ **Migração aplicada DIRETO** (via `db execute`) porque o Neon tem uma migration
> ANTERIOR falha (`20260808180000_financeiro`, P3009) que bloqueia `migrate deploy`.
> A mudança (aditiva/idempotente) já está no banco. Falta João **resolver a
> financeiro** e então `migrate resolve --applied 20260823130000_catalog_template_system_scope`
> (ou `migrate deploy`, que reaplica idempotente).

---

## Situacao atual

Existe o padrão POR ORGANIZAÇÃO (`PromotionalCatalogTemplate`, org-scoped, via
`toTemplateConfig` — já captura fundo, grade, `cardLayout` e, desde #1, os elementos
dinâmicos em `templateDynamic`). NÃO existe um nível de sistema (universal) nem a
divisão em 3 categorias, nem "imagens de inspiração".

Há precedente de escopo de sistema: `PromotionalPriceStyle` (`organizationId String?`
+ `scope "USER"|"SYSTEM"` + `isSuperUser(email)`), com `price-style-create/list/delete`.

Arquivos principais:
- `src/app/router/promotional-catalog/template-*.ts` — CRUD de padrões (org-scoped)
- `src/app/router/promotional-catalog/price-style-*.ts` — **modelo a espelhar** (scope SYSTEM)
- `src/features/promotional-catalog/types.ts` — `toTemplateConfig` / `TEMPLATE_OMIT_KEYS`
- `prisma/schema.prisma` — `PromotionalCatalogTemplate` (precisa de `scope` + `organizationId?`)

---

## Criterios de aceite

- [x] Aba **"Padrões do Sistema"** ("Sistema") com 3 sub-abas: Fundo / Grupo / Etiquetas.
- [x] Cada categoria salva a fatia relevante (fundo / grupo+grade / etiquetas +
      textos e imagens dinâmicas) a nível **SYSTEM** (só super-usuário cria/edita/exclui).
- [x] Inspiração via **miniatura** (thumbnail JPEG) do padrão — aplicar copia só a
      aparência da categoria; **nunca** produtos/preços/lista.
- [x] Aplicar (`applyTemplateSlice`) faz merge só das chaves da categoria.
- [x] Usuário comum vê/aplica; só super-usuário salva/exclui (gating por `canManageSystem`).
- [ ] Falta teste visual (preview deslogado) e afinar o layout da galeria de padrões.

---

## Decisoes a tomar (pendentes de aprovação)

- **Modelo**: adicionar `scope String` + tornar `organizationId String?` em
  `PromotionalCatalogTemplate` (migração aditiva, espelhando `PromotionalPriceStyle`)
  **ou** criar modelo novo `PromotionalCatalogSystemTemplate`. → Migração necessária.
- **Categorias**: um campo `kind: "background"|"group"|"label"` no padrão para as 3
  sub-abas, filtrando `toTemplateConfig` por categoria.
- **Imagens de inspiração**: guardar `sampleImages: string[]` (chaves R2/URLs) no config
  do padrão; renderizar como mock read-only. Nunca entram em `list`/`pages`/produtos ao aplicar.

---

## Proximos passos

1. Aprovar decisões de modelo/migração acima.
2. Migração aditiva: `scope` + `organizationId?` em `PromotionalCatalogTemplate`
   (manual + `migrate deploy` por causa do drift do Neon compartilhado). Bump `SCHEMA_VERSION`.
3. Router: `template-create/list/delete` com `scope` (espelhar `price-style-*`).
4. `toTemplateConfig(config, kind)` — recorta por categoria; captura `sampleImages`.
5. UI: aba "Padrões do Sistema" + 3 sub-abas; aplicar = só aparência.
6. Validar tsc + biome; testar.

---

## Riscos

- **Migração no Neon compartilhado** → usar migration manual + `migrate deploy` (ver
  memória `migration-drift-cosmos`); bump `SCHEMA_VERSION` senão o Prisma Client fica velho.
- **Imagens de inspiração** não podem vazar para o catálogo de quem aplica — separar
  claramente "aparência" de "conteúdo de exemplo".
