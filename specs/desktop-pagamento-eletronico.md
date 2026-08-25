# Pagamento eletrônico (PaymentProcessor / TEF) — PDV desktop

> Arquitetura ports & adapters do pagamento eletrônico do PDV desktop, revisada para suportar diferentes processadores/adquirentes sem antecipar a tecnologia (TEF/SDK) real.
> Feature: `packages/core/src/payment*.ts` + `apps/desktop/src/lib/payment.ts` + `apps/desktop/src/features/pdv/payment-step.tsx`
> Criado em: 2026-08-20 · Atualizado em: 2026-08-20
> Status: 🟡 Domínio pronto (Mock como contrato) · adapter real = corte futuro

---

## Situacao atual

O pagamento eletrônico já é ports & adapters, exercitado por um Mock determinístico
(não há maquininha real). O domínio é puro e agnóstico ao protocolo; a UI e o
orquestrador falam só com o port. Falta: escolher a tecnologia real (TEF/SDK) e
escrever o adapter correspondente — corte específico, ainda não iniciado.

Arquivos principais:
- `packages/core/src/payment.ts` — domínio PURO: `PaymentState`, transições, `PaymentInstrument`, `PaymentRequest`, `PaymentSnapshot`, helpers (`isResolved`/`isInFlight`/`requiresReconciliation`/`canTransitionPayment`).
- `packages/core/src/payment-processor.ts` — o **port** `PaymentProcessor` (`start`/`status`/`cancel`/`reconcile`).
- `packages/core/src/adapters/mock-payment-processor.ts` — 1º adapter (Mock determinístico).
- `apps/desktop/src/lib/payment.ts` — wiring/DI (`getPaymentProcessor`), polling do ciclo (`capturePayment`), `reconcilePayment`, anti-corrupção `instrumentToMethod`.
- `apps/desktop/src/features/pdv/payment-step.tsx` — UI; reage a snapshots, não conhece tecnologia.

---

## Decisoes tomadas

Revisão arquitetural aprovada em 2026-08-20 (antes de qualquer TEF real):

- **Port mínimo e agnóstico** — mantém 4 métodos (`start`/`status`/`cancel`/`reconcile`). **`confirm()` NÃO entra no port agora.** É two-phase commit de *alguns* TEFs; não é universal. Default: detalhe do adapter. Só sobe ao port se **vários** adapters compartilharem — operação de port que vira no-op na metade dos adapters é sinal de que não pertence ao port.
- **Evidência externa é OPCIONAL e agnóstica** — `PaymentSnapshot` ganhou `externalTransactionId?`, `provider?`, `metadata?`; mantidos `authorization?`/`nsu?` (nomes já existentes, **não** renomear). O domínio conhece o CONCEITO de evidência; o adapter traduz o que o processador fornece; o resto vai em `metadata`.
- **Ausência de NSU/autorização NÃO invalida `approved`** — o que define aprovação é o processador ter confirmado, não a presença de identificador.
- **Não adivinhar o resultado** — `timeout ≠ declined` e `timeout ≠ approved`. `timeout` é resultado DESCONHECIDO; nunca vira recusa pelo tempo. `error` = técnico sem aprovação. Toda transição passa por `canTransitionPayment`.
- **Reconciliação é primeira classe** — `reconcile()` descobre o desfecho de um `timeout`; **pode permanecer desconhecido** (seguir `timeout`) ou virar `error`. A UI **não finaliza** a venda sem resultado confiável. Retry/reconcile **preservam a identidade** da transação (mesmo `paymentId`/`externalTransactionId`) — nunca segunda cobrança por causa de timeout.
- **Regra de produto (não de domínio): cartão exige autorização online.** Pagamento eletrônico no PDV exige o processador/adquirente online. **Contingência offline de cartão está fora de escopo.** ERP offline ≠ pagamento offline: o TEF tem o link dele com o adquirente; só o espelho da venda no ERP fica pendente no outbox.
- **Separação rígida (inalterada)** — `Sale` (o que vendeu) × `Payment/Tender` (como pagou) × `CashMovement` (impacto na gaveta) × `PaymentProcessor` (integração). Cartão/PIX **não** incham o esperado da gaveta — só `VENDA` em `DINHEIRO` entra em `salesCash`/`expectedCash` (`summarizeCash`, e `router/caixa/_access.ts` no servidor). A finalidade do `CashMovement` não muda.
- **Adapter esconde a tecnologia** — o resto do sistema não conhece TEF/adquirente/pinpad/SDK/fornecedor. Trocar adapter não toca no domínio.

### Máquina de estados (referência)

```
pending ─► in_progress ─► approved | declined | cancelled | timeout | error
timeout ─► approved | declined | error        (via reconcile; nunca declined pelo tempo)
```

---

## Feito agora (corte de preparação, 2026-08-20)

Mínimo, não-quebra, sem tocar em port de estados / UI / adapter real:

- [x] `PaymentSnapshot` estendido com `externalTransactionId?`, `provider?`, `metadata?` — `packages/core/src/payment.ts`
- [x] Doc de `authorization`/`nsu` revisada: evidência opcional; ausência não invalida aprovação
- [x] Doc de `reconcile()` revisada: resultado pode permanecer desconhecido
- [x] Mock preenche `provider: "mock"` e `externalTransactionId` na aprovação — prova os campos novos
- [x] Teste do Mock cobre os campos novos — `payment-processor.test.ts` (32 testes verdes)

---

## Proximos passos (corte do TEF real — NÃO iniciar sem escolher a tecnologia)

Quando escolhermos o 1º TEF, um corte específico deve, nesta ordem:

1. Estudar o protocolo real do TEF/adquirente escolhido.
2. Mapear as operações reais para `start`/`status`/`cancel`/`reconcile`.
3. Identificar quais estados e identificadores ele de fato fornece.
4. Identificar se há **confirmação explícita** (e decidir: detalhe do adapter × operação do port).
5. Identificar como o **cancelamento** funciona (abortar × estorno).
6. Identificar como **consulta/reconciliação** funcionam (consulta × resolução de pendência).
7. Identificar como **timeout / queda de comunicação** são tratados (e janela de reversão automática).
8. Só então definir o adapter real — `apps/desktop/src/lib/adapters/<x>-payment-*.ts`, gated por `isNative()` em `getPaymentProcessor()`.

Não inventar comportamento do TEF para preencher lacunas da abstração.

### Persistência e recuperação (fronteiras a preparar no corte real)

Hoje o `PaymentSnapshot` vive só em memória no `payment-step`. Na integração real
ele precisa **persistir** e ter resolução no boot/drain — **mesmo padrão do outbox
causal do caixa**, não mecanismo novo. Matriz de cenários:

| Cenário | Estado local | Finaliza venda? | Reconciliar? | Identificador | Retry? | Bloquear nova tentativa? |
|---|---|---|---|---|---|---|
| PDV fecha durante o pagamento | in_progress/timeout | Não | Sim | `paymentId` | Não (é reconcile) | Sim, até reconciliar |
| PDV perde conexão com o TEF | timeout | Não | Sim | `paymentId` | Não | Sim |
| PDV perde conexão com o ERP | pagamento resolvido; venda no outbox | Sim | Não (pagamento) | evidências no `SalePayment` | Sync, não recobrança | — |
| TEF aprova, resposta não chega | timeout | Não | Sim | `paymentId` | Não | Sim |
| ERP recebe venda, resposta não chega ao PDV | venda pode duplicar no outbox | — | Não (dedupe de venda) | `clientOperationId`/`saleNumber` | Sim (mesmo id → dedupe) | — |
| PDV reinicia com pagamento pendente | pendente persistido | Não até resolver | Sim | `paymentId` | Não | Sim, até reconcile no boot |

---

## Fora de escopo

- Contingência **offline** de cartão (autorizar sem link com o adquirente).
- Adapter real de qualquer TEF/adquirente/SDK antes do estudo do protocolo.
- `confirm()` no port sem justificativa vinda do protocolo real escolhido.
- Conciliação por arquivo de liquidação (EDI) do adquirente no backend — degrau contábil posterior (amarra `authorization`/`nsu` do `SalePayment` ao que o adquirente liquidou).

---

## Relação com outros specs

- `desktop-offline.md` / `desktop-fase-*.md` — o PDV desktop onde isto roda; o outbox causal (fase 3/4) é o padrão reaproveitado para recuperação de pagamento pendente.
- `pagamentos-gateway.md` — **coisa diferente**: gateway online (PIX/boleto/cartão via Asaas/Stripe) do ERP web. Aqui é o pagamento eletrônico *presencial* do PDV (maquininha/TEF).
