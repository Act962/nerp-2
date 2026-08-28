# TradeGram + ERP 100% operável no mobile

> Tornar o ERP Admin e o TradeGram (hoje desktop-first) totalmente operáveis no celular, no nível do que os apps de campo (Promotor/Vendedor) já entregam. Épico — várias sessões.
> Escopo transversal: `src/app/(main)/(rest)/*`, `/trade/*`, `src/components/app-sidebar.tsx`, tabelas hand-rolled, editores Konva.
> Branch: `feat/mobile-operacional` · Pilar: Transversal (adoção em campo)
> Criado em: 2026-08-18 · Status: 📋 Planejado (épico)

---

## Situacao atual

O NERP tem 8 apps. **Mobile-first hoje:** App Promotor, App Vendedor (`(promotor)/*`), App PDV viewer, App Garçom, Painel Pedidos, Storefront. **Desktop-first (o gap):** o **ERP Admin** (`(main)/(rest)/`, sidebar + 17 áreas + `/trade/*`) e o **TradeGram admin**. São justamente onde ficam as operações que o dono/gerente/trade precisa fazer em movimento.

Padrões atuais que impactam mobile:
- Sidebar (`src/components/app-sidebar.tsx`) — layout de shell desktop.
- **Tabelas hand-rolled** com `components/ui/table.tsx` (não `@tanstack/react-table`) — não têm modo responsivo/card.
- Formulários RHF + `Field*` — geralmente ok em mobile, mas dialogs largos não.
- **Editores Konva** (mapa, planograma) — `ssr:false`, pensados para mouse; tocar/pinçar/arrastar precisa de tratamento (parte já feita no mapa: marquee, pan por arraste).

---

## Abordagem proposta (faseada)

### Fase 0 — Auditoria de responsividade
- [ ] Varrer `(main)/(rest)/*` e `/trade/*` classificando cada página: ✅ usável / ⚠️ quebra / ❌ inoperável no mobile (375px). Sai uma tabela de prioridade.

### Fase 1 — Shell + navegação
- [ ] Sidebar colapsável / drawer no mobile; header com menu; breadcrumbs compactos.
- [ ] `middleware`/layout garantindo que o app admin abre utilizável em 375px.

### Fase 2 — Tabelas e listas
- [ ] Modo card/stacked para as tabelas hand-rolled em telas estreitas (um wrapper reutilizável), preservando paginação por cursor (`use-cursor-pagination`).

### Fase 3 — Formulários e dialogs
- [ ] Dialogs viram bottom-sheet/fullscreen no mobile; inputs e botões com alvo de toque ≥44px.

### Fase 4 — Editores de toque (Konva)
- [ ] Mapa e planograma: gestos de toque (pan/zoom/seleção) revisados para mobile; toolbar adaptada.

## Criterios de aceite

- [ ] Toda página do ERP Admin e do TradeGram abre e é **operável** em 375px (criar/editar/consultar), verificado no viewport mobile do preview.
- [ ] Nenhuma ação essencial depende de hover ou de arrastar com mouse sem equivalente de toque.
- [ ] Tabelas grandes não geram scroll horizontal da página (rolam dentro de container próprio ou viram cards).
- [ ] Editores Konva navegáveis por toque (pan/zoom) sem quebrar o desktop.
- [ ] Sem regressão de layout no desktop.

---

## Decisoes tomadas

- **Web responsivo, não app nativo** — reaproveita o mesmo Next.js; não é React Native. (Confirmar com o dev se o alvo é PWA instalável.)
- **Épico** — cada fase pode virar sua própria branch/PR/sessão; este spec é o guarda-chuva.
- **Depende de** `auditoria-sincronizacao` só para priorizar quais telas o campo mais usa.

---

## Melhorias futuras (nao urgentes)

- [ ] PWA instalável (manifest + service worker) para o ERP Admin.
- [ ] Modo offline seletivo (já há `specs/pdv-offline.md` para o PDV).
