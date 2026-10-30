# Cancelamento de venda — ERP

> Desfazer uma venda já concluída: estorno de estoque, caixa e financeiro, e cancelamento da NFC-e na SEFAZ.
> Feature: `src/features/sales` + `src/app/router/sales/cancel.ts` + menu de `/vendas`
> Criado em: 2026-10-29 · Atualizado em: 2026-10-29
> Status: 🟡 Em andamento — implementado, aguardando teste do dev

---

## Situacao atual

Antes desta spec, não havia como desfazer uma venda concluída. O item "Cancelar venda" do menu de Vendas não fazia nada, e os cancelamentos que existiam eram só os de item do carrinho (`cancel-request`, com PIN do supervisor) e a recusa de pedido do catálogo. Com a NFC-e (`specs/fiscal-nfce.md`), desfazer a venda passou a ter um prazo legal: a nota só pode ser cancelada em até 30 minutos.

Arquivos principais:
- `src/features/sales/server/cancel-sale.ts` — o estorno, numa transação
- `src/app/router/sales/cancel.ts` — a procedure `sales.cancel`
- `src/features/sales/components/cancel-sale-dialog.tsx` — diálogo com justificativa
- `prisma/schema.prisma` — `CashMovementType.ESTORNO`, `Sale.cancelReason`, `Sale.cancelledById`

---

## Decisoes tomadas

- **A NFC-e vem PRIMEIRO, fora da transação.** Ir à SEFAZ não se desfaz, e a recusa dela (fora do prazo) tem de impedir o estorno, nunca o contrário. Se a nota cancelar e a transação falhar depois, repetir é seguro: na segunda vez não há mais nota autorizada e o estorno segue.
- **Nota ainda em andamento (aguardando envio ou na SEFAZ) bloqueia.** Cancelar a venda enquanto a nota pode ser autorizada a qualquer instante deixaria uma nota válida de uma venda que não existe.
- **Nota rejeitada não bloqueia** — ela não existe na SEFAZ. O número dela vira "pulado" e aparece para inutilizar na tela de Notas fiscais.
- **Fora do prazo da nota, a venda não é cancelada aqui.** O caminho legal é a devolução (NF-e de devolução, `fiscal-nfce.md` Fase 5).
- **Quem pode:** owner/admin ou quem tem a permissão `autorizar-cancelamento` — a mesma regra de quem autoriza cancelamento de item no PDV. Justificativa de 15 a 255 caracteres (a regra da SEFAZ, porque ela também vai na nota).
- **Só venda do PDV** (`PDV`, `CATALOGO_APROVACAO`, `CATALOGO_COZINHA`). Pedido pago pelo Órbita ou pelo marketplace foi cobrado fora daqui, e o reembolso também acontece fora.
- **Estoque:** cada movimento `VENDA` da venda ganha um `DEVOLUCAO` de mesma quantidade. A base são os movimentos gravados, não os itens, porque são o que de fato saiu do estoque.
- **Caixa:** um movimento `ESTORNO` por forma de pagamento, que subtrai do total da sessão (e da gaveta, se for em dinheiro). Ele vai na sessão da venda, se ainda estiver aberta. Senão, vai na sessão aberta de quem cancela (o dinheiro sai da gaveta de hoje). Se nenhuma das duas estiver aberta, nada vai para o caixa, e a tela avisa que a devolução em dinheiro precisa ser registrada à mão. Sessão fechada nunca é alterada.
- **Financeiro:** os lançamentos da venda viram `CANCELLED`, e o DRE e o fluxo de caixa já ignoram esse status. A venda some dos relatórios em vez de virar "receita + despesa" que se anulam.
- **Corrida:** a transação começa mudando o status com `updateMany` condicionado ao status atual. Dois cliques simultâneos não estornam duas vezes.

---

## Pendencias

### Funcional

- [ ] **Devolução parcial** (devolver um item, não a venda toda) — depende da NF-e de devolução.
- [ ] **Reembolso no gateway** para PIX/cartão integrados (`Transaction`) — hoje o estorno é só contábil.
