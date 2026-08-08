# Impressão de Cupom — ESC-POS/PDF/DANFE + editor de cupom

> Impressão de cupom fiscal e não-fiscal (térmica, PDF/A4, DANFE do provedor) com um editor de cupom moderno por blocos.
> Feature: `src/features/receipt-designer` (novo, editor) + integração em `src/features/sales/components/novo/sale-completed-dialog.tsx` + `prisma/schema.prisma`
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

A impressão **não existe** — os botões `onPrintReceipt`/`onPrintInvoice` em `sale-completed-dialog.tsx` são no-op (`() => {}`). Existe infra de PDF via `@react-pdf/renderer` (books/catálogo/mapa) que serve de base para o PDF/A4. Sem ESC-POS, sem impressora térmica. Diferencial pedido: **editor de cupom moderno**, reaproveitando a experiência dos editores do projeto (Konva/planograma, PDF).

Arquivos principais:
- `src/features/sales/components/novo/sale-completed-dialog.tsx` — botões de impressão (no-op)
- `src/features/books/server/generate-book.tsx` — padrão `@react-pdf` (referência)

---

## Pendencias

### Funcional

- [ ] **Impressão térmica ESC-POS 80mm** — via agente local (ex.: QZ Tray) ou print CSS do navegador.
- [ ] **PDF/A4** — reusar o padrão `@react-pdf/renderer` (comprovante/recibo/orçamento).
- [ ] **DANFE/DANFCe do provedor** — usar o PDF gerado em `fiscal-emissao`.
- [ ] **Model `ReceiptTemplate`** — JSON de blocos, `organizationId`, tipo (fiscal/não-fiscal/orçamento), `isDefault`.
- [ ] **Um template → dois renderers** — o mesmo modelo alimenta ESC-POS e PDF/A4.
- [ ] Substituir os `onPrint*` no-op pela impressão real, escolhendo o template.

### UX

- [ ] **Editor WYSIWYG por blocos** (`src/features/receipt-designer`) — preview em tempo real (80mm e A4); blocos: **logo**, cabeçalho (razão social/CNPJ/endereço), itens/totais, **QR Code** (PIX copia-e-cola / link NFCe / URL livre), **links**, **informações adicionais** (troca, promoção), rodapé.
- [ ] **Layouts/presets** — fiscal, não-fiscal/recibo, orçamento; templates salvos por org.
- [ ] Variáveis nos campos (`{{cliente}}`, `{{total}}`, `{{vendedor}}`) resolvidas na emissão.

### Qualidade de codigo

- [ ] Renderização única (um modelo de blocos → dois alvos) para não divergir térmica × PDF.

---

## Decisoes tomadas

- **Três alvos**: ESC-POS 80mm + PDF/A4 + DANFE do provedor.
- **Editor de cupom moderno** como diferencial de UI (QR, logo, links, informações adicionais, layouts).
- **Um template alimenta os dois renderers** (térmica e PDF).

---

## Proximos passos

1. Model `ReceiptTemplate` (migration + generate + bump).
2. Renderer compartilhado (blocos → ESC-POS e PDF).
3. Editor `receipt-designer` (WYSIWYG + presets).
4. Integrar no `sale-completed-dialog` (escolha de template + impressão real).

---

## Melhorias futuras (nao urgentes)

- [ ] Impressão de segunda via / reimpressão a partir do histórico de vendas.
- [ ] Envio digital do cupom (WhatsApp/e-mail) a partir do mesmo template.
