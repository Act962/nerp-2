# Fiscal — Cadastro tributário + reforma (IBS/CBS)

> Base tributária: regime da org, campos fiscais do produto e motor de cálculo, já preparado para a reforma (IBS/CBS/IS).
> Feature: `src/app/router/products` (extensão) + `src/features/products` (extensão) + `src/lib/fiscal` (novo, cálculo) + `prisma/schema.prisma`
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

Não existe **nenhuma tributação real**: `Product` só tem `ncm`. Sem CST, CFOP, CEST, origem, alíquotas, sem regime tributário na org, e **nada de IBS/CBS** (reforma — NT 2025.002). Esta spec é a **fundação** das specs `fiscal-emissao` e `impressao-cupom`.

Arquivos principais:
- `prisma/schema.prisma` — `Product` (só `ncm`), `Organization`
- `src/app/router/products/*`, `src/features/products/*` — CRUD atual

---

## Pendencias

### Funcional

- [ ] **Campos fiscais no `Product`** — `origem`, `cfopPadrao`, `cest`, `cClassTrib`, `cstIbsCbs`, unidade tributável, além do `ncm` já existente.
- [ ] **Regime tributário na `Organization`/loja** — Simples/Presumido/Real, série NFCe, CSC, ambiente homolog/prod.
- [ ] **Tabelas de apoio** — CFOP, CST (ICMS e IBS/CBS), NCM (seed/consulta).
- [ ] **Reforma (NT 2025.002)** — grupos IBS/CBS/IS por item, `cClassTrib`, `cindOp`, `pDevTrib` (cashback) modelados.
- [ ] **Motor de cálculo** (`src/lib/fiscal/*`) — dado produto + operação, calcula os tributos (agnóstico ao provedor).

### UX

- [ ] Aba/seção "Tributação" no cadastro de produto (origem, CFOP, CST, cClassTrib, CEST).
- [ ] Config de regime tributário em Configurações da org.

### Qualidade de codigo

- [ ] Manter o cálculo **agnóstico ao provedor** (a emissão em `fiscal-emissao` consome esta camada).

---

## Decisoes tomadas

- **Construção do zero** — não existe em nenhum projeto da máquina (verificado `nasaex-wey`/legado).
- **Agnóstico ao provedor** — o cadastro e o cálculo não dependem de quem emite; o provedor entra só em `fiscal-emissao`.
- **Já nascer com IBS/CBS** — os campos da reforma entram desde o modelo, mesmo que a emissão comece em homologação.

---

## Proximos passos

1. Modelar campos fiscais de `Product` + regime da org + tabelas de apoio.
2. Migration + `prisma generate` + bump `SCHEMA_VERSION`.
3. Motor de cálculo em `src/lib/fiscal`.
4. UI de tributação no produto e na org.

---

## Melhorias futuras (nao urgentes)

- [ ] Importação de tabelas oficiais (cClassTrib/CST) atualizadas.
- [ ] Simulador de carga tributária por produto/operação.
