# Fiscal — Emissão NFe/NFCe (via provedor)

> Emissão de documentos fiscais (NFe/NFCe) a partir da venda, via provedor fiscal, com venda fiscal × não-fiscal.
> Feature: `src/app/router/fiscal` (novo) + `src/lib/fiscal/<provider>.ts` (novo) + Inngest + `prisma/schema.prisma`
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

Não há **nenhuma emissão fiscal**: só `Sale.invoiceNumber` (texto, nunca escrito). Sem NFe/NFCe, XML, SEFAZ, DANFE, certificado. Depende da spec `fiscal-tributacao` (cadastro + cálculo). O `nasaex-wey` só define o **contrato de retorno** que o cliente NASA espera (`xmlUrl`, `pdfUrl`, `icms`, `authorizedAt`, `cancelledAt`, `cancellationReason`) — útil para modelar a saída.

---

## Pendencias

### Funcional

- [ ] **Model `FiscalDocument`** — tipo (NFe/NFCe), série, número, chave, XML, status SEFAZ, `saleId`; numeração sequencial por série (contador atômico, padrão do `pdv-caixa`).
- [ ] **Cliente do provedor** (`src/lib/fiscal/<provider>.ts`) — Focus NFe / Tecnospeed / NFe.io / PlugNotas / Nuvem Fiscal (a confirmar); o provedor mantém a NT 2025.002/IBS-CBS atualizada.
- [ ] **Emissão assíncrona (Inngest)** — padrão `book-generate`: grava status PENDING → evento → `onFailure` marca FAILED → client faz poll.
- [ ] **Cancelamento / contingência** — cancelar nota, tratar rejeição, contingência quando SEFAZ/provedor cair.
- [ ] **Venda fiscal × não-fiscal** — toggle no PDV; não-fiscal só gera recibo (ver `impressao-cupom`).
- [ ] **Expor os campos de retorno na `Sale`** (`xmlUrl`, `pdfUrl`, `authorizedAt`, `cancelledAt`) para manter o contrato do cliente NASA.

### UX

- [ ] Status da nota no PDV / na venda (emitindo, autorizada, rejeitada, cancelada) com poll.
- [ ] Ação de reemitir/cancelar.

### Qualidade de codigo

- [ ] Numeração fiscal sequencial **sem corrida** (mesmo padrão atômico do `pdv-caixa`).
- [ ] Segredos do provedor/certificado por org, nunca logados.

---

## Decisoes tomadas

- **Via provedor (recomendado)** — não emissão in-house; o provedor cuida de certificado, SEFAZ, DANFE, contingência e das mudanças da reforma. Ponto de integração plugável (`src/lib/fiscal/<provider>.ts`), confirmado o provedor no início desta spec.
- **Construção do zero** — confirmado que não existe no `nasaex-wey` (só o contrato de retorno).

---

## Proximos passos

1. Confirmar o provedor fiscal.
2. Model `FiscalDocument` + numeração por série (migration + generate + bump).
3. Cliente do provedor + emissão via Inngest.
4. Toggle fiscal/não-fiscal no PDV + status/poll.
5. Cancelamento e contingência.

---

## Melhorias futuras (nao urgentes)

- [ ] MDFe/CTe se houver logística própria.
- [ ] Relatórios fiscais (SPED, resumos por CFOP/CST).
