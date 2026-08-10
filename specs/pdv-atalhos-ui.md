# PDV — Atalhos globais + refino de UI

> Sistema global de atalhos de teclado (F8 abrir caixa, F11 buscar produto…) e refino da UI do PDV, mantendo o layout simples de hoje.
> Feature: `src/hooks/use-hotkeys` (novo) + `src/features/sales` (refino) · reaproveita `src/hooks/use-barcode-scan.ts`, `src/components/ui/command.tsx`
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

Não há sistema global de atalhos: só `src/hooks/use-barcode-scan.ts` (leitor de código de barras) e o toggle da sidebar (Cmd/Ctrl+B do shadcn). `cmdk` está instalado (`src/components/ui/command.tsx`) mas usado apenas como combobox, nunca como paleta de comandos global. Depende do `pdv-caixa` (F8 abrir caixa pressupõe a sessão).

---

## Pendencias

### Funcional

- [ ] **Gerenciador global de atalhos** (`src/hooks/use-hotkeys` novo) — mapa configurável: F8 abrir caixa, F11 buscar produto, F2 pagamento, etc.
- [ ] **Paleta de comandos global** — usar `cmdk`/`command.tsx` como `CommandDialog` (não só combobox).
- [ ] Reaproveitar `use-barcode-scan.ts` para leitura de produto no PDV.

### UX

- [ ] Refino da UI do PDV **mantendo o layout atual** — fluxo por teclado, header com `caixa-status-badge`, atalhos visíveis (dica na tela).
- [ ] Legenda/ajuda de atalhos (ex.: `?` abre a lista).

### Qualidade de codigo

- [ ] Atalhos não devem disparar dentro de inputs/textareas; escopo por tela.

---

## Decisoes tomadas

- **Manter a UI simples de hoje** — só refinar o necessário; atalhos e fluxo por teclado, sem redesenho.
- Reusar `cmdk` (já instalado) e `use-barcode-scan.ts` em vez de nova lib.

---

## Proximos passos

1. Hook global de atalhos + registro por tela.
2. `CommandDialog` global (buscar produto/comandos).
3. Amarração F8/F2 ao `pdv-caixa` e ao pagamento.
4. Refino da UI do PDV + legenda de atalhos.

---

## Melhorias futuras (nao urgentes)

- [ ] Atalhos configuráveis pelo usuário.
- [ ] Modo "somente teclado" para operação rápida no balcão.
