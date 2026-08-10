# PDV — Resiliência offline transparente

> O PDV reconhece a queda de internet sozinho e continua vendendo offline, sincronizando automaticamente ao reconectar, sem perda de dados.
> Feature: `src/features/sales` (offline) + service worker/PWA + IndexedDB (outbox) + `src/app/router/sales` (sync)
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

O app é **online-only**: sem PWA/service worker, sem IndexedDB, sem fila offline. Persistência só via oRPC → Prisma → Postgres. Requisito: ao cair a internet, o sistema **reconhece automaticamente** e opera offline **sem trocar de ambiente nem reabrir nada**; ao voltar, **sincroniza sozinho**. Depende do `pdv-caixa` (sessão espelhada no client).

---

## Pendencias

### Funcional

- [ ] **Detecção automática de conexão** — `navigator.onLine` + heartbeat leve (distinguir "sem rede" de "server fora"); indicador discreto no header (troca de modo transparente).
- [ ] **Catálogo local** — cache de produtos em IndexedDB (`idb`/`dexie`), atualizado por intervalo enquanto online e no login/abertura de caixa; busca de produto (F11) e preços funcionam offline.
- [ ] **Outbox de vendas** — venda offline gravada localmente com id temporário; nunca perdida.
- [ ] **Sync automático ao reconectar** — fila drena idempotente (chave de dedupe por venda); **numeração atribuída pelo server** no sync (client nunca decide `saleNumber`).
- [ ] **Sync periódica bidirecional** — reconcilia catálogo/estoque (web→local) e drena o outbox (local→web).
- [ ] **PWA** — manifest + service worker (serwist/next-pwa), escopo nas rotas de PDV.

### UX

- [ ] Indicador online/offline e "N vendas pendentes de sincronização".
- [ ] Feedback claro quando o sync conclui / falha.

### Qualidade de codigo

- [ ] Idempotência e resolução de conflitos "server assigns" (server é a fonte da verdade).

---

## Decisoes tomadas

- **Offline transparente, só no PDV** — sem troca de ambiente; foco no que cai em loja. ERP inteiro offline está fora.
- **Numeração de venda pelo server no sync** — evita colisão; casa com o contador atômico do `pdv-caixa`.
- **Fiscal offline** — NFCe exige provedor/SEFAZ online; venda offline sai **não-fiscal/contingência** e a nota é emitida ao reconectar (ver `fiscal-emissao`). Fora do MVP offline.

---

## Proximos passos

1. PWA (manifest + service worker) escopado no PDV.
2. Catálogo local (IndexedDB) + sync periódica.
3. Outbox de vendas + sync idempotente com numeração no server.
4. Indicadores e feedback de sincronização.

---

## Melhorias futuras (nao urgentes)

- [ ] Reimpressão/consulta de vendas offline após sync.
- [ ] Métricas de tempo offline / vendas em contingência.
