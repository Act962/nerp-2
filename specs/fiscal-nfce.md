# Fiscal — NFC-e em Teresina (PI), do cadastro à contingência offline

> Spec mestre do épico fiscal: o que é cada peça, a estratégia escolhida (híbrida) e as fases até a primeira nota real em Teresina e, depois, a NFC-e offline no `apps/desktop`.
> Feature: `packages/fiscal` + `apps/web/src/lib/fiscal` + `apps/web/src/app/router/fiscal*` + `apps/web/src/features/fiscal-*` + `apps/desktop` (fase 6)
> Criado em: 2026-10-28 · Atualizado em: 2026-10-28
> Status: 🟡 Em andamento — Fases 0 a 3 feitas, aguardando teste do dev
> Absorve as specs `fiscal-tributacao.md` (4) e `fiscal-emissao.md` (5), que ficam como histórico.

---

## Glossário mínimo

Quem pega este épico sem saber nada de fiscal precisa só disto:

| Termo | O que é |
|---|---|
| **NFC-e (modelo 65)** | Nota de venda ao consumidor final no balcão. Cupom 80mm com QR Code (o **DANFCe**). CPF do cliente é opcional. **É por onde começamos.** |
| **NF-e (modelo 55)** | Nota entre empresas (B2B), devolução, transferência. Exige destinatário completo. Impressa em A4 (o **DANFE**). Fase 5. |
| **SEFAZ** | Secretaria da Fazenda do estado — quem autoriza a nota. A do Piauí delega a NFC-e e a NF-e para a **SVRS** (Sefaz Virtual do RS). |
| **Autorização** | A nota só existe quando a SEFAZ devolve o **protocolo**. Sem protocolo, não houve nota. |
| **Certificado A1** | Arquivo `.pfx` + senha (e-CNPJ, validade de 1 ano). É com ele que a empresa **assina** o XML. Já guardado com segurança (`fiscal-seguranca-certificado.md`). |
| **CSC** | Código secreto que a SEFAZ-PI entrega no credenciamento de NFC-e; entra no QR Code (versão 2). Na versão 3 do QR (NT 2025.001) o CSC sai e a contingência passa a ser assinada com o certificado. |
| **Chave de acesso** | 44 dígitos que identificam a nota (UF, mês, CNPJ, modelo, série, número, tipo de emissão, código aleatório, DV). Calculada em `@nerp/fiscal`. |
| **Série / número** | Cada nota tem série (1–999) e número sequencial dentro da série. Buraco na sequência obriga a **inutilizar** o número na SEFAZ. |
| **NCM** | Classificação do produto (8 dígitos). |
| **CFOP** | Natureza da operação (4 dígitos). `5102` = venda de mercadoria dentro do estado; `5405` = venda de mercadoria com ICMS já recolhido por substituição tributária. |
| **CRT** | Regime da empresa na nota: 1 = Simples Nacional, 2 = Simples com excesso de sublimite, 3 = Regime Normal, 4 = MEI. |
| **CST / CSOSN** | Como o ICMS do item é tratado. Regime Normal usa **CST** (`00`, `40`, `60`…); Simples Nacional usa **CSOSN** (`102`, `103`, `500`…). |
| **Homologação × produção** | Ambiente de teste (nota sem valor) × ambiente real. Todo cliente passa por homologação antes. |
| **Rejeição** | A SEFAZ recusou (código `cStat` + motivo). Corrige e reenvia. Mapeado em `packages/fiscal/src/cstat.ts`. |
| **Cancelamento** | Desfaz uma nota autorizada, só dentro de prazo curto e com justificativa (mín. 15 caracteres). |
| **Contingência offline (`tpEmis = 9`)** | Sem internet, o caixa emite e assina a NFC-e localmente, imprime o cupom marcado "EMITIDA EM CONTINGÊNCIA" e transmite depois (prazo legal de até 24h). |

**Quem decide o imposto de cada produto é o contador do cliente, não o NERP.** Nosso papel é tornar o preenchimento fácil, validar formato, oferecer padrões por regime e recusar emitir com cadastro incompleto — nunca adivinhar CST/NCM.

---

## Situacao atual

A fundação existe e nada é emitido: `FiscalConfig` cadastra empresa, certificado A1 (bucket privado, senha cifrada), tokens da Focus e CSC; `Product` tem `ncm`/`cfop`/`cstIcms`/… como texto livre; `FiscalDocument` existe no schema e nunca é escrito; `@nerp/fiscal` (chave, QR v2/v3, autorizador por UF, `cStat`) não é importado por nenhum app; `lib/fiscal/focus-nfe.ts` e `lib/fiscal/sefaz-pi.ts` só fazem ping. O PDV oferece um checkbox "Gerar Nota Fiscal (NF-e)" que não chega ao servidor.

Arquivos principais:
- `packages/fiscal/src/*` — núcleo isomórfico (servidor + webview do Tauri)
- `apps/web/src/lib/fiscal/*` — certificado, cifra, storage, Focus, SEFAZ-PI
- `apps/web/src/app/router/fiscal-config/index.ts` — configuração fiscal da org
- `apps/web/src/features/fiscal-config/components/*` — painel em Configurações
- `apps/web/src/features/sales/components/novo/{payment-dialog,sale-completed-dialog}.tsx` — PDV
- `apps/web/src/features/receipt-designer/*` — cupom (já tem bloco QR `nfce`)
- `prisma/schema.prisma` — `FiscalConfig`, `FiscalDocument`, `Product`, `Customer`, `Sale`, `SaleItem`

---

## Decisoes tomadas

- **Estratégia híbrida** (decidido pelo dev em 2026-10-28):
  - **Online → provedor Focus NFe.** Mandamos JSON da venda; a Focus monta o XML, assina, fala com a SVRS, devolve XML + DANFCe e acompanha as notas técnicas (reforma IBS/CBS inclusa). É o caminho mais curto até a primeira nota real.
  - **Offline (desktop, Fase 6) → emissão própria só da contingência.** O terminal monta o XML com `@nerp/fiscal`, assina, imprime; o servidor transmite à SVRS quando a conexão volta. O provedor não serve aqui: sem internet não se alcança a Focus.
- **O NERP é dono da numeração**, não o provedor. Série e próximo número vivem no nosso banco (contador atômico, mesmo padrão de `lastSaleNumber`) e são enviados à Focus. Sem isso, a série offline do desktop e a série online do provedor não conviveriam sem colisão. *(Confirmar na documentação da Focus o envio explícito de `serie`/`numero` na NFC-e — ver Perguntas abertas.)*
- **Uma série por terminal na contingência** — o caixa offline nunca disputa número com outro caixa nem com o servidor. A série online (ex.: 1) é do servidor; cada terminal pareado recebe a sua (ex.: 101, 102…).
- **Nota é 1:N com a venda**, não 1:1. Reemissão após rejeição, NFC-e cancelada e reemitida, NF-e de devolução: todas ficam no histórico. Troca `FiscalDocument.saleId @unique` por índice simples + tabela de eventos.
- **Cópia fiscal no item da venda** — `SaleItem` grava NCM, CFOP, CST/CSOSN, origem e alíquotas no momento da venda. Reemitir ou cancelar não pode depender do cadastro do produto de hoje.
- **MVP com um CNPJ por organização** (`FiscalConfig` como está), porque o piloto de Teresina é loja única. O documento guarda o CNPJ emitente, então a passagem para "emitente por loja" (redes com filiais) não reescreve histórico. Fica registrada em Melhorias futuras.
- **Emissão assíncrona via Inngest**, padrão do projeto: a venda fecha, grava `FiscalDocument` `PENDING`, dispara evento; a função chama a Focus, consulta até autorizar/rejeitar, baixa XML e DANFCe para o bucket fiscal privado; o PDV acompanha por poll. A venda **nunca** espera a SEFAZ para concluir.
- **Venda fiscal × não fiscal explícita.** Com fiscal configurado e ativo, o padrão do PDV é emitir NFC-e; sem configuração, o PDV não oferece nota nenhuma (nada de checkbox que não faz nada).
- **Começa por Simples Nacional (CRT 1)**, o regime provável dos clientes de Teresina. Regime Normal (CST + ICMS próprio + PIS/COFINS) entra quando houver cliente.
- **Conta de parceiro/revenda na Focus**, com as empresas de cada cliente cadastradas por API a partir do `FiscalConfig` — o cliente do NERP não precisa ter login na Focus.

---

## Arquitetura — portas e adaptadores

Decidido em 2026-10-28: a emissão é escrita em camadas, para o provedor ser
**trocável** e as regras **testáveis sem banco, sem rede e sem SEFAZ**.

```
            apps/web (infra)                     packages/fiscal (sem infra)
 ┌────────────────────────────────┐     ┌──────────────────────────────────────┐
 │ oRPC  fiscal.emitir/cancelar   │──►  │ aplicacao/  CASOS DE USO             │
 │ Inngest  fiscal-emit           │──►  │   SolicitarEmissaoNfce               │
 │                                │     │   ProcessarEmissao                   │
 │ ADAPTADORES (implementam as    │     │   ReenviarDocumentoRejeitado         │
 │ portas):                       │     │   CancelarDocumentoFiscal            │
 │   Prisma → Repositorio,        │◄────│ aplicacao/portas.ts  (interfaces)    │
 │            Numeracao, Montador │     │   ProvedorFiscal, ProvedoresFiscais, │
 │   R2     → ArmazenamentoFiscal │     │   RepositorioDocumentoFiscal,        │
 │   Focus  → ProvedorFiscal      │     │   NumeracaoFiscal, MontadorDeNota,   │
 │   (amanhã: outro provedor)     │     │   ArmazenamentoFiscal, Relogio, Id   │
 └────────────────────────────────┘     │ dominio/  NotaFiscal, DocumentoFiscal│
                                        │   (máquina de estados), validação,   │
                                        │   CPF/CNPJ/GTIN, rateio de desconto  │
                                        │ core/  chave, QR Code, cStat         │
                                        └──────────────────────────────────────┘
```

- **Domínio** (`packages/fiscal/src/dominio`) — o que é uma nota e as regras que não dependem de ninguém: totais em centavos, rateio do desconto da venda entre os itens, validação antes de reservar número, e `DocumentoFiscal`, a classe que só permite transições legais (`PENDING → PROCESSING → AUTHORIZED → CANCELLED`, `REJECTED → PENDING`…).
- **Aplicação** (`packages/fiscal/src/aplicacao`) — casos de uso como classes com dependências injetadas pelo construtor. Eles só conhecem as **portas** (interfaces); nunca importam Prisma, `fetch` ou Focus.
- **Infra** (`apps/web`, Fase 2) — adaptadores que implementam as portas. É a ÚNICA parte que muda ao trocar de provedor.
- **Testes** (`@nerp/fiscal/testes`) — adaptadores em memória e `ProvedorFiscalSimulado`, que se comporta como um provedor real (chave válida, idempotência da `ref`, SEFAZ assíncrona, queda, rejeição por NCM inexistente).
- **Teste de contrato** (`@nerp/fiscal/testes/contrato`) — `testarContratoDoProvedorFiscal(...)`: a bateria que todo provedor precisa passar. O simulado passa nela em todo `pnpm test`; a Focus vai passar contra a homologação. **Trocar de provedor = escrever um adaptador novo + passar no contrato.** Nenhum caso de uso muda.

O contrato de `ProvedorFiscal` (em `portas.ts`) fixa quatro regras: reenviar a mesma `ref` não emite outra nota (exceto ref rejeitada, que aceita o conteúdo corrigido); rejeição é resposta, não exceção; queda de rede lança `ProvedorIndisponivelError` (o único erro que vai para o retry do Inngest); consultar ref desconhecida lança `ReferenciaDesconhecidaError`.

Decisões de domínio já codificadas, com o porquê nos comentários:
- valores em **centavos** (float erra a soma e a SEFAZ rejeita total divergente);
- **valida antes de reservar número** (número reservado e não usado obriga inutilização);
- o documento guarda **o conteúdo enviado** (reenvio e auditoria usam o mesmo, mesmo se o produto mudar);
- `dhEmi` é a hora do **envio**, não da criação (NFC-e com emissão atrasada é rejeitada — 704);
- autorização confere que a chave devolvida **é desta nota** (modelo/série/número);
- `PROCESSING` **só consulta**, nunca reenvia.

Onde os adaptadores reais vão morar (Fase 2):

```
apps/web/src/features/fiscal/server/
  container.ts                  monta os casos de uso com os adaptadores reais
  infra/prisma-documentos.ts    RepositorioDocumentoFiscal
  infra/prisma-numeracao.ts     NumeracaoFiscal (UPDATE ... RETURNING atômico)
  infra/prisma-montador.ts      Sale + Product + FiscalConfig → NotaFiscal
  infra/r2-armazenamento.ts     ArmazenamentoFiscal (bucket fiscal privado)
  infra/provedores.ts           FiscalConfig.provider → adaptador
  infra/focus/provedor.ts       ProvedorFiscal da Focus
  infra/focus/mapeador.ts       NotaFiscal → JSON da Focus (puro, testado)
```

---

## Fases

Cada fase = 1 branch = 1 PR, nesta ordem. Nada sobe para `main` sem o dev validar.

### Fase 0 — Honestidade e ambiente · `feat/fiscal-fase-0`

- [x] **Tirar o falso "Gerar Nota Fiscal (NF-e)" do PDV** (`payment-dialog.tsx`, `sale-completed-dialog.tsx`, `create-sale/index.tsx`) — volta na Fase 2 ligado à emissão real, e com o nome certo (NFC-e). — ✅ 2026-10-28
- [ ] Criar o bucket privado no R2 e definir `FISCAL_S3_BUCKET_NAME` e `FISCAL_ENCRYPTION_KEY` no Coolify/Vercel (pendência de `fiscal-seguranca-certificado.md`).
- [ ] Apagar do bucket de imagens os `.pfx` legados, depois do reenvio.

### Fase 1 — Cadastro tributário que serve para nota · `feat/fiscal-fase-1`

> ✅ Implementada em 2026-10-28 — aguardando teste do dev. Migration `20261028120000_fiscal_fase_1_cadastro` + `SCHEMA_VERSION` v109.

- [x] **Validação de formato** no produto, com a regra única de `@nerp/fiscal` (`validarCamposFiscais`): NCM 8 dígitos (pontuação ignorada), CEST 7, CFOP 5xxx/6xxx, CSOSN ou CST conforme o regime, PIS/COFINS pela tabela oficial, origem 0–8, cClassTrib 6, CST IBS/CBS 3. Aplicada no `products.create`/`update` e na edição em lote; vazio agora LIMPA o campo (antes `?? undefined` impedia apagar). — ✅ 2026-10-28
- [x] **Padrões por regime** em `FiscalConfig` (`defaultCfop`, `defaultCstIcms`, `defaultCstPis`, `defaultCstCofins`), editados no painel fiscal com o botão "Usar sugestão do Simples (5102 · 102 · 49 · 49)". Produto sem o campo usa o padrão (`resolverTributacao`). — ✅ 2026-10-28
- [x] **Edição fiscal em massa** — `products.bulkUpdateFiscal` + diálogo na tela de prontidão; só os campos preenchidos são aplicados. — ✅ 2026-10-28
- [x] **Tela "Cadastro fiscal"** (`/produtos/fiscal`, item no menu Produtos) — quantos produtos ativos estão prontos, contagem por pendência, lista do que falta com seleção para o lote. Roda a mesma regra que a montagem da nota vai usar (`products.fiscalReadiness`). — ✅ 2026-10-28
- [x] **Formulário de produto** — selects com descrição (CSOSN/CST conforme o regime), "Usar padrão da empresa (102)" no vazio, validação enquanto digita, alíquotas só no Regime Normal, grupo IBS/CBS. — ✅ 2026-10-28
- [x] **Dados fiscais do cliente** — `cityCode` (preenchido pelo CEP via ViaCEP), `stateRegistration`, `ieIndicator`; UF validada como sigla; contribuinte exige IE. Campos aparecem só para PJ. — ✅ 2026-10-28
- [x] **Campo `cstIbsCbs`** no produto, ao lado do `cClassTrib`. — ✅ 2026-10-28
- [x] **`fiscalConfig.taxProfile`** — regime e padrões sem segredos, para o cadastro de produto (o `get` continua exigindo owner/admin). — ✅ 2026-10-28
- [ ] Confirmar com a Focus o que ela exige hoje no grupo IBS/CBS para Simples Nacional.

Testes: `cadastro-produto.test.ts` (14, domínio), `customer/_fiscal.test.ts` (4), `tests/integration/fiscal-cadastro.test.ts` (7 — padrões, taxProfile, normalização, limpar campo, prontidão com padrão, lote sem vazar entre empresas, validação no lote).

### Fase 2 — Primeira NFC-e em homologação · `feat/fiscal-fase-2`

> ✅ Implementada em 2026-10-28 — aguardando teste do dev. Migration `20261029120000_fiscal_fase_2_emissao` + `SCHEMA_VERSION` v110. Falta só a conta da Focus para rodar contra a homologação de verdade.

- [x] **Domínio, casos de uso, portas e teste de contrato** em `@nerp/fiscal` (ver Arquitetura). — ✅ 2026-10-28
- [x] **Schema** — `FiscalDocument` 1:N com a venda (+ `tpEmis`, `emitterCnpj`, `nota` JSON com o conteúdo enviado, `qrCodeUrl`, `consultaUrl`), número único por série, índice parcial "um documento vigente por venda e modelo" (fecha o duplo clique), `FiscalSeries` com numeração atômica. — ✅ 2026-10-28
- [x] **Adaptadores Prisma** — `RepositorioDocumentoFiscalPrisma`, `NumeracaoFiscalPrisma` (`INSERT … ON CONFLICT DO UPDATE … RETURNING`, parte de `nfceNextNumber`) e `MontadorDeNotaPrisma`. A tradução venda → nota é a função pura `montarNotaDaVenda`: o total da nota é o `Sale.total`, e o desconto é o que falta para os itens brutos chegarem nele, rateado (absorve desconto por item, desconto na venda e arredondamento de pesáveis). — ✅ 2026-10-28
- [x] **Adaptador Focus** (`infra/focus/`) — `paraPedidoFocus` (puro) e `ProvedorFocus`, que passa em `testarContratoDoProvedorFiscal` contra uma Focus falsa com as respostas documentadas. Protocolo e data de autorização saem do XML autorizado (o POST da NFC-e não devolve protocolo). — ✅ 2026-10-28
- [x] **Provedor simulado em dev** — `FISCAL_PROVEDOR_SIMULADO=1` (ignorado em produção) troca a Focus pelo simulado e o bucket por memória: dá para testar o PDV inteiro sem conta nem certificado. — ✅ 2026-10-28
- [x] **Emissão** — `fiscal.emitirNfce` tenta transmitir na hora (NFC-e na Focus é síncrona) e, se o provedor cair ou a SEFAZ demorar, enfileira o job Inngest `fiscal-emit` (consulta a cada 10 s, nunca reenvia; erro de configuração é `NonRetriableError`). — ✅ 2026-10-28
- [x] **Procedures** `fiscal.situacao`, `emitirNfce`, `daVenda`, `tentarNovamente`, `reenviar`, `cancelar` (owner/admin). — ✅ 2026-10-28
- [x] **PDV** — "Emitir NFC-e" só aparece quando `fiscal.situacao` diz que dá; CPF/CNPJ na nota opcional e validado; tela de venda concluída acompanha a nota (emitindo / aguardando SEFAZ / autorizada / rejeitada com motivo e "Reenviar" / sem resposta com "Tentar agora"); impressão automática espera a autorização; o cupom vira DANFCe (cabeçalho, aviso de homologação, chave em blocos, consumidor, protocolo, QR Code). `sales.create` passou a devolver o `id`. — ✅ 2026-10-28
- [ ] **Cadastro da empresa na Focus por API** (conta de revenda) — hoje a empresa é cadastrada no painel da Focus e o token vai em Integrações → Focus NFe.
- [ ] **Rodar o contrato contra a homologação da Focus** — confirma `cest`, `codigo_barras_*` e `valor_troco`, que não aparecem nas páginas públicas da documentação.
- [ ] **IBS/CBS no pedido da Focus** — o mapeador ainda não envia o grupo da reforma.

Testes: `montar-nota.test.ts` (9), `focus/mapeador.test.ts` (7), `focus/provedor.test.ts` (contrato + 4), `sale-completed-dialog.test.tsx` (+3), `tests/integration/fiscal-emissao.test.ts` (8 — situação, emissão autorizada, idempotência, numeração e número inicial, cadastro incompleto sem gastar número, CPF na nota, isolamento entre empresas, cancelar e reemitir).

**Limites conhecidos desta fase:** só Simples Nacional/MEI (Regime Normal é barrado com mensagem); venda com frete não sai em NFC-e; cancelar a venda não cancela a nota sozinho (a Fase 3 deixou o lado fiscal pronto — ver lá); cancelamento de NFC-e na Focus só até **30 minutos** após a emissão.

### Fase 3 — Operação completa · `feat/fiscal-fase-3`

> ✅ Implementada em 2026-10-29 — aguardando teste do dev. Migrations `20261030120000_fiscal_fase_3_status_voided` e `20261030120100_fiscal_fase_3_inutilizacao` (duas porque o Postgres não usa um valor novo de enum na mesma transação que o criou) + `SCHEMA_VERSION` v111.

- [x] Cancelamento dentro do prazo (30 min na NFC-e, 24 h na NF-e — `PRAZO_CANCELAMENTO_MS`), com justificativa, pela tela de notas e direto no PDV logo após a venda. O prazo é conferido antes de ir à SEFAZ; o XML do evento de cancelamento é guardado (`cancelXmlKey`). Ligado ao cancelamento da venda em `specs/vendas-cancelamento.md`: cancelar a venda em Vendas cancela a NFC-e primeiro, e a recusa da SEFAZ (fora do prazo) barra o estorno de estoque, caixa e financeiro. Nota ainda em transmissão também barra.
- [x] Tela **Vendas → Notas fiscais** (`/vendas/notas-fiscais`): filtros por situação, período e número; baixar XML da nota e do cancelamento; reenviar rejeitada; tentar de novo a parada; cancelar dentro do prazo.
- [x] Inutilização (aba Numeração): o NERP calcula os números pulados da série (reservados que não viraram nota; rejeitada só conta depois de 24 h, para dar tempo de reenviar), inutiliza na SEFAZ e guarda o XML. Rejeitadas dentro da faixa viram `VOIDED`, e a venda pode emitir outra nota. Só owner/admin, só faixa já reservada, nunca número com nota que exista na SEFAZ.
- [x] Alertas na tela de notas e na configuração fiscal: certificado vencendo (30 = info, 15 = aviso, 7 ou vencido = crítico), mesma rejeição 3 vezes em 24 h, nota parada há mais de 15 min, números pulados. Função pura `alertasFiscais()` em `@nerp/fiscal`.
- [x] Pacote mensal para o contador (`/api/fiscal/xml-mensal?mes=AAAA-MM`, owner/admin): zip com `autorizadas/`, `canceladas/` (nota + evento), `inutilizadas/` e `resumo.csv` (abre no Excel). Conta a data da autorização.

**Limites conhecidos desta fase:** alertas aparecem na tela, não chegam por e-mail/WhatsApp (falta um canal de notificação no app); o zip é montado em memória — folgado para o volume de um varejo, revisar se um cliente passar de dezenas de milhares de notas por mês; no modo simulado, os XMLs ficam na memória do servidor e somem quando ele reinicia.

### Fase 4 — Produção com o piloto de Teresina

- [ ] Checklist do cliente (abaixo) completo; homologação aprovada; troca de ambiente para `PRODUCAO`; acompanhamento dos primeiros dias.

### Fase 5 — NF-e modelo 55 e entrada por XML · `feat/fiscal-fase-5`

- [ ] NF-e de venda B2B (destinatário completo) e de devolução (`finNFe = 4`) referenciando a nota original.
- [ ] Importação do XML da NF-e do fornecedor na entrada de nota (`specs/entrada-de-nota.md`), casando itens por EAN e validando a chave com `chaveValida()`.

### Fase 6 — Contingência offline no desktop · `feat/desktop-fiscal` (a partir de `feat/desktop`)

- [ ] Série de contingência reservada por terminal no pareamento.
- [ ] Certificado no terminal guardado no keyring do SO (comando Rust), nunca em arquivo solto; assinatura injetada em `@nerp/fiscal`.
- [ ] Montagem do XML NFC-e no terminal (`@nerp/fiscal`), QR v3 assinado, DANFCe "EMITIDA EM CONTINGÊNCIA".
- [ ] Outbox leva o XML assinado junto com a venda; o servidor transmite direto à SVRS (driver SOAP com mTLS, sem a Focus) e trata rejeição de contingência.
- [ ] Alarme quando houver nota de contingência perto das 24h sem transmitir.

---

## Checklist por cliente (o que pedir antes de emitir)

1. CNPJ ativo e **Inscrição Estadual ativa na SEFAZ-PI**.
2. **Regime tributário** confirmado com o contador (Simples Nacional / MEI / Normal).
3. **Certificado A1** (`.pfx`) + senha, dentro da validade, do mesmo CNPJ.
4. **Credenciamento como emissor de NFC-e** na SEFAZ-PI e o **CSC + ID do CSC** de homologação e de produção.
5. **Cadastro fiscal dos produtos** revisado pelo contador (NCM, CFOP, CSOSN/CST, CEST quando houver ST).
6. Impressora térmica 80mm no caixa.

---

## Perguntas abertas

- [ ] **Focus**: plano de parceiro/revenda (cadastro de empresas por API, preço por CNPJ) e se a NFC-e aceita `serie`/`numero` enviados por nós.
- [x] ~~Prazo de cancelamento~~ — a Focus documenta 30 minutos para NFC-e.
- [ ] **SEFAZ-PI**: versão do QR Code exigida hoje (v2 com CSC ou v3) — a Focus monta o QR; importa para a contingência offline (Fase 6).
- [ ] **Contingência pela Focus**: a Focus tem modo `forma_emissao=offline` e um "Comunicador Offline" local. Avaliar antes da Fase 6 se ele substitui a emissão própria no desktop.
- [ ] **Reforma**: o que é obrigatório em 2026 no JSON da Focus para Simples Nacional.

---

## Proximos passos

1. Dev: `pnpm db:deploy` + `pnpm db:generate`, `FISCAL_PROVEDOR_SIMULADO=1` no `apps/web/.env` e testar o PDV e a tela de notas com o provedor simulado (Fases 1 a 3).
2. Dev: conta na Focus + token de homologação + cliente piloto → trocar o simulado pela Focus e rodar o contrato contra a homologação.
3. Fase 4 — produção com o piloto.

---

## Melhorias futuras (nao urgentes)

- [ ] Emitente por estabelecimento (redes com filiais de CNPJs distintos, ex.: clientes Winthor).
- [ ] Regime Normal completo (ICMS próprio, ST com MVA, FCP, `cBenef`, PIS/COFINS não cumulativo).
- [ ] Distribuição de DF-e e manifestação do destinatário (puxar as NF-e de compra emitidas contra o CNPJ).
- [ ] Envio do DANFCe por WhatsApp/e-mail.
- [ ] NFS-e (serviços, municipal) — sistema à parte, só se houver demanda.
