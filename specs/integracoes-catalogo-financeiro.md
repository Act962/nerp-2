# Integrações — Catálogo de conectores (bancos, adquirentes, gateways)

> A aba Integrações vira uma loja de conectores: cards com logo por categoria, o usuário escolhe o provedor e instala com as credenciais dele. Só conector direto — API própria ou arquivo oficial do provedor, sem agregador.
> Feature: `src/features/integracoes` (novo) + `src/app/router/integracoes` (novo) + `src/app/(main)/(rest)/integracoes` (existe)
> Criado em: 2026-08-29 · Atualizado em: 2026-08-29
> Status: 🟡 Fase 1 implementada — aguardando teste do dev

---

## Situacao atual

`/integracoes` hoje são **três abas com um card cada** — ERP (Winthor/Oracle), Fiscal (Focus NFe) e Google Drive — num `max-w-4xl`. É o layout "uma integração por aba": não escala para dezenas de provedores e não tem onde encaixar banco nem adquirente.

O que já existe e vai ser reaproveitado em vez de reinventado:

- `src/features/erp-sync/components/integracoes-page.tsx` (404 linhas) — a página atual, com as `Tabs` e os três painéis.
- `ErpConnection.configCiphertext` + `encryptSecret`/`decryptSecret` (`src/lib/nasa-s2s-crypto.ts`, AES-256-GCM, chave `NASA_S2S_ENCRYPTION_KEY`) — o cofre de credencial por organização, já em produção.
- `GoogleDriveConnection` + `src/app/api/integrations/google/{authorize,callback}` + `src/lib/google/token-manager.ts` — o fluxo OAuth2 completo (autorizar, cifrar refresh token, renovar, remover conexão ao ser revogada).
- `src/features/erp-sync/server/connectors/types.ts` — a doutrina do conector plugável: *o contrato fala linguagem de negócio; a palavra "Oracle" só existe dentro de `winthor.ts`*. É a regra que mantém o catálogo genérico.
- `src/lib/fiscal/certificate.ts` + `storage.ts` — leitura de certificado A1 (.pfx com senha) e guarda em bucket privado. **A maioria dos bancos exige mTLS**, então esse caminho já resolvido é reaproveitado, não refeito.
- `PaymentBankAccount` e `PaymentEntry` (`prisma/schema.prisma:4523` e `:4606`) — **já existem no schema**, ao contrário do que `financeiro-contas.md` descreve como "a portar".

Rota, chave de permissão (`integracoes`, `src/lib/permissions.ts:190`) e item de sidebar já existem — nada a mexer em `src/middleware.ts`.

---

## Matriz de credenciais (pesquisa de agosto/2026)

O que cada provedor pede para o lojista integrar. A coluna que decide a ordem de trabalho é **Autosserviço**: se o cliente consegue gerar a credencial sozinho ou se depende de gerente/programa de parceria.

### Bancos

| Provedor | Autenticação | Credenciais | Capacidade | Autosserviço |
|---|---|---|---|---|
| **Banco Inter** | OAuth2 client_credentials + mTLS | `client_id`, `client_secret`, certificado `.crt` + chave `.key`, nº da conta | extrato, saldo, cobrança, pagamento, Pix | ✅ **Sim** — Internet Banking → "Soluções para sua empresa" → Nova Integração → baixa chaves e certificado. Só PJ (PF/MEI não têm) |
| **Sicoob** | OAuth2 client_credentials + mTLS | `client_id`, certificado ICP-Brasil `.pfx` + senha (e `.cer` público para cadastrar) | Conta Corrente v4 (extrato, saldo), Pix, cobrança | ✅ **Sim** — cadastro de aplicação em `developers.sicoob.com.br`, com sandbox |
| **Sicredi** | OAuth2 client_credentials + mTLS | `client_id`, `client_secret`, **código de acesso**, chave privada + certificado (via CSR) | extrato de conta corrente, Pix, cobrança | 🟡 Portal público, mas o certificado passa por CSR validado pelo Sicredi |
| **Banco do Brasil** | OAuth2 + chave de aplicação | `client_id`, `client_secret`, `developer_application_key` (`gw-dev-app-key`) | API de Extratos (lançamentos + saldo parcial), Pix, cobrança | 🟡 App criado no portal nasce em sandbox; passar para produção envolve o gerente |
| **Itaú** | OAuth2 + mTLS (certificado dinâmico) | `client_id`, `client_secret`, certificado dinâmico (chave pública + privada + token temporário, por ambiente) | Extrato, Cash Management, Pix | 🟡 Autosserviço no devportal, mas Cash Management tem credencial própria e o certificado vence e exige reemissão |
| **Santander** | OAuth2 + mTLS | `client_id`, `client_secret`, certificado x509 v3 PEM com *Key Usage: digital signature* (mín. 90 dias) | extrato, saldos, cobrança, pagamento | 🟡 Chaves geradas no portal, certificado de certificadora autorizada |
| **Bradesco** | OAuth2/JWT + certificado | `client_id` **solicitado por e-mail** (`suporte.api@bradesco.com.br`), certificado `.cer`/`.crt`/`.pem` (4 meses a 3 anos) | cobrança e extrato | ❌ Não — obtenção de credencial é processo manual com o banco |
| **Caixa** | WebService/API 1.0 | ativação do WebService junto ao banco; padrão CNAB240 para arquivo | boleto, Pix, pagamentos, extrato | ❌ Não — sem portal de desenvolvedor nem suporte dedicado, só manuais |
| **Nubank, C6, BTG** | — | — | — | ❌ Sem API pública de extrato PJ para lojista |

### Adquirentes

Aqui está o achado que muda o plano: **na maioria das adquirentes a API de conciliação não é do lojista**. A credencial de e-commerce (transacionar) é fácil de obter; a de *ler as vendas liquidadas* costuma ser produto separado ou restrito a empresas conciliadoras homologadas.

| Provedor | Autenticação | Credenciais | Conciliação | Autosserviço |
|---|---|---|---|---|
| **PagBank** | token de API EDI | `USER` (nº do estabelecimento) + `TOKEN` | ✅ **API do Extrato EDI em JSON** — `GET /movement/v3.00/{transactional\|financial\|cashouts\|balances}/{AAAA-MM-DD}`, paginado (máx. 1000), dado íntegro em D+1 | ✅ **Sim** |
| **Mercado Pago** | OAuth2 / access token | `access_token` (painel do desenvolvedor) | ✅ Settlement report / released money — cria e baixa relatório por período (CSV/XLSX) | ✅ **Sim** |
| **Cielo** | MerchantId + MerchantKey (e-commerce) | `MerchantId`, `MerchantKey` | 🟡 Conciliação é o **EDI Extrato Eletrônico**: arquivo posicional baixado do site Cielo, não REST | 🟡 Credencial sim, conciliação por arquivo |
| **Rede** | PV + Token (Basic Auth) | `PV` (nº de afiliação) + `Token` (chave de integração do Portal Rede) | ❌ A **API EDI é exclusiva para empresas conciliadoras**; lojista fica com o arquivo EDI | 🟡 Credencial sim, conciliação não |
| **Stone** | ClientApplicationKey + SecretKey | idem | ❌ API de Conciliação é BackOffice: exige cadastro no **canal de Parcerias** e formulário aprovado. Sem sandbox | ❌ Não |
| **Getnet** | OAuth2 client_credentials | `seller_id`, `client_id`, `client_secret` (Painel Getnet → Configurações → Identificação API) | ❌ Extrato de vendas e recebíveis **não fazem parte** da API de pagamentos — são os produtos Extrato Eletrônico e Conciliação, vendidos à parte | 🟡 Credencial sim, conciliação não |
| **SumUp, Ton, InfinitePay, Vero** | — | — | ❌ Sem API pública de conciliação para o lojista (integração é de checkout/link de pagamento) | ❌ Não |

### Leitura da matriz

- **Banco tem API de extrato de verdade; adquirente quase não tem.** Do lado bancário, cinco provedores dão extrato ao próprio correntista. Do lado das maquininhas, só PagBank e Mercado Pago entregam conciliação ao lojista por API.
- **mTLS é o padrão bancário, não a exceção.** Inter, Sicoob, Sicredi, Itaú e Santander exigem certificado. O conector precisa de `https.Agent`/`undici` com cert+key, o que **obriga runtime Node** (não Edge) em toda rota que chamar banco.
- **O certificado vence.** Itaú e Santander têm prazo curto; certificado vencido derruba a integração em silêncio. Health check com aviso de expiração não é melhoria futura, é requisito.
- **Para cartão, arquivo EDI é o padrão — não o plano B.** Cielo, Rede, Stone e Getnet distribuem conciliação por arquivo, e é sobre isso que rodam os conciliadores comerciais brasileiros. API de conciliação para lojista é a exceção (PagBank e Mercado Pago). Suportar EDI não é degradar escopo: é o caminho principal da maioria dos clientes.

---

## O que os conectores resolvem — e o que nao

Conector é **coleta**. A conciliação é outra coisa, e é onde está o trabalho de verdade:

| Perna | Origem | Estado |
|---|---|---|
| O que eu vendi | `Sale` + `SalePayment` (PDV) | ⚠️ **falta NSU e adquirente** — ver Dependências |
| O que a adquirente vai pagar (líquido de taxa, parcelas, ajustes) | conector ou arquivo EDI | ✅ PagBank/MP por API; Cielo, Rede, Stone e Getnet por arquivo |
| O que caiu na conta | extrato bancário | ✅ resolvido pelos conectores de banco |

A adquirente deposita um valor só na conta — `CIELO 1234 · R$ 4.532,10`. Quebrar esse bolo nas vendas individuais, com a taxa de cada uma, é o serviço, e nenhuma API faz isso por nós: o motor de casamento (janela de tolerância, chave valor+data+NSU, fila de divergências, casamento manual) é código nosso, igual para qualquer provedor instalado.

Consequência prática: **a conciliação bancária passa a ter insumo assim que a Fase 1 subir; a de cartão não roda nem com a API da adquirente perfeita**, porque a chave que falta é do nosso lado.

---

## Dependencias

- **`SalePayment` não guarda NSU nem adquirente** (`prisma/schema.prisma:1232` — só `method`, `amount`, `saleId`). Sem NSU não existe chave para casar venda × liquidação, e a conciliação de cartão fica limitada ao agregado do dia por bandeira: acusa que faltou dinheiro, não diz qual venda. Campos necessários: `acquirer`, `nsu`, `authorizationCode`, `brand`, `installments`, `terminalId`. Território do [`pdv-caixa.md`](./pdv-caixa.md) — **não entra nesta PR**, mas bloqueia a Fase 2; registrar lá também.
- **Modelo de conta ainda em aberto** — `financeiro-contas.md` não decidiu entre `FinancialAccount`/`Transaction` e `PaymentBankAccount`/`PaymentEntry`. Bloqueia a Fase 4 (persistir lançamento), não as anteriores.

---

## Pendencias

### Critico

- [ ] **Nunca aceitar senha de internet banking** — só credencial de API, token OAuth ou certificado. Pedir a senha da conta é scraping. Campo de senha de banco não pode existir em nenhum manifesto.
- [ ] **Segredo não volta para o client** — a listagem devolve `••••4321`; o texto claro só é decifrado dentro de `server/`. Nenhuma procedure devolve `credentialsCiphertext`.
- [x] **Certificado e chave privada cifrados junto das credenciais** — ✅ 2026-08-29. Ver Decisões: o PEM entra no mesmo blob AES-256-GCM em vez de ir para o bucket privado.
- [ ] **Sanitizar `lastSyncError`** — erro de provedor costuma ecoar o header de autenticação, e o campo é lido na tela.
- [ ] **Instalar/desinstalar só para owner/admin** — `requirePermission("integracoes")` protege a página, mas a procedure precisa checar o papel: quem vê o catálogo não é quem grava credencial.
- [ ] **`@@unique` com `externalRef` nulo não restringe nada** — no Postgres dois `NULL` não colidem; usar `default("")`, senão dá para instalar o mesmo provedor duas vezes sem querer.
- [ ] **Rotas que falam com banco precisam de runtime Node** — mTLS não funciona em Edge.

### Funcional

- [ ] **Manifesto por provedor** (`src/features/integracoes/catalog/`) — um arquivo declarativo por provedor. Banco novo = um arquivo, zero mudança de UI.
- [ ] **Model `FinancialIntegration`** — uma instalação por org/provedor/conta.
- [ ] **Formulário derivado do manifesto** — o zod é montado a partir de `auth.campos`; não se escreve tela por provedor.
- [ ] **Upload de certificado no formulário** — campo `tipo: "file"` com validação de formato por provedor (`.crt`+`.key` no Inter, `.pfx`+senha no Sicoob).
- [ ] **`testarConexao` obrigatório antes de gravar** — instalar sem validar guarda credencial quebrada que só falha no primeiro cron.
- [ ] **Aviso de expiração de certificado** — data lida do próprio certificado no upload, alerta em D-30.
- [ ] **Migrar os três painéis existentes para cards** — ERP, Fiscal e Drive entram no mesmo grid, com o conteúdo levantado como está para dentro do dialog, sem reescrita.

### UX

- [ ] **Grid por categoria** com card = logo + nome + resumo + badge de estado.
- [ ] **Cinco estados de card, nenhum deles mentindo** — `Instalado` (verde + "sincronizado há 2h"), `Disponível` (botão "Conectar"), `Só arquivo` (botão "Enviar extrato", não "Conectar"), `Em breve` (`opacity-60`, sem botão), `Erro` (badge destrutivo + motivo).
- [ ] **Fallback de logo** — monograma com a cor do manifesto quando o SVG não existe, senão o catálogo fica bloqueado esperando 30 arquivos de arte.
- [ ] **Campo com ajuda de origem** — cada credencial diz onde achar aquilo ("Internet Banking → Soluções para sua empresa → Nova Integração"). É o que decide se o lojista instala sozinho.
- [ ] **Card diz o pré-requisito** quando não é autosserviço ("requer solicitação ao gerente", "requer contrato de conciliação") — antes de o usuário abrir o formulário e travar.

### Qualidade de codigo

- [ ] **Provedor não vaza do conector** — `Inter`, `PagBank`, `Cielo` só podem existir dentro do arquivo do próprio conector, como `Oracle`/`Winthor` hoje. Quem consome recebe DTO de negócio.
- [ ] **Uma tela de credencial só** — `pagamentos-gateway.md` prevê "tela/config de credenciais do gateway por org". Essa pendência é **absorvida por este catálogo**; `PaymentGatewayConfig` não deve nascer como model separado de `FinancialIntegration`.

---

## Desenho

### Estrutura

```
src/features/integracoes/
  catalog/                    CÓDIGO compartilhado client/server — não trafega
    types.ts                  ProviderManifest, CredentialField, Capacidade
    index.ts                  registro, seções, ehSegredo
    bancos.ts                 inter, sicoob, sicredi, bb, itau, santander, bradesco, caixa
    adquirentes.ts            pagbank, mercado-pago, cielo, rede, stone, getnet
    nativos.ts                winthor, focus-nfe, google-drive (painel próprio)
  server/
    connectors/
      types.ts                FinancialConnector + DTOs de negócio
      http-mtls.ts            node:https com cert+key, compartilhado pelos bancos
      inter.ts                primeiro conector real
    credentials.ts            cifrar/decifrar, mascarar, sanitizarErro
    certificado.ts            validade lida do próprio PEM
    resolve-connector.ts      o único switch por provedor do sistema
  components/
    integracoes-page.tsx      grid por categoria (substitui a antiga)
    provider-card.tsx         card + os cinco estados
    provider-logo.tsx         next/image + fallback monograma
    install-dialog.tsx        formulário derivado do manifesto
  hooks/use-integracoes.ts
```

Um arquivo por CATEGORIA, não por provedor: são manifestos de ~20 linhas, e
dezesseis arquivos de vinte linhas custam mais para navegar do que rendem. A
promessa continua de pé — provedor novo é uma entrada num arquivo, sem tocar em
UI, model ou migration.

`erp-sync/components/integracoes-page.tsx` vira `erp-sync/components/winthor-panel.tsx` — mesmo corpo, sem o `<h1>` e sem as `Tabs`.

### Manifesto

A forma de `auth` saiu da pesquisa: banco brasileiro é quase sempre *client_credentials + mTLS*, então mTLS é uma flag, não um tipo à parte.

```ts
export type ProviderManifest = {
  id: string;                    // "inter" — casa com FinancialIntegration.providerId
  nome: string;
  categoria: IntegrationCategory;
  logo: string | null;           // /integracoes/<id>.svg — null cai no monograma
  cor: string;
  resumo: string;
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS" | "OAUTH2_AUTHORIZATION_CODE" | "API_KEY" | "ARQUIVO";
    mtls?: boolean;              // exige certificado + chave privada
    campos: CredentialField[];   // { key, label, tipo: text|password|file, ajuda }
    scopes?: string[];
    formatos?: ("OFX" | "CNAB240" | "CNAB400" | "EDI" | "CSV")[];
  };
  capacidades: Capacidade[];     // extrato | saldo | recebiveis | taxas | cobranca
  ambientes: ("sandbox" | "producao")[];
  disponivel: boolean;           // false = card "Em breve", sem formulário
  preRequisito?: string;         // "requer solicitação ao gerente"
  docsUrl?: string;
};
```

### Model

```prisma
model FinancialIntegration {
  id                    String  @id @default(cuid())
  organizationId        String
  providerId            String  // casa com o manifesto em código
  status                IntegrationStatus @default(ACTIVE)
  credentialsCiphertext String? @db.Text  // AES-256-GCM; NUNCA sai para o client
  certificateKey        String? // caminho no bucket privado (mTLS)
  certificateExpiresAt  DateTime?
  environment           String  @default("producao")
  externalRef           String  @default("")  // conta/estabelecimento — "" e não null, ver Critico
  displayName           String? // "Inter — Conta 1234"
  capabilities          String[]
  bankAccountId         String? // PaymentBankAccount que recebe os lançamentos
  installedById         String
  lastSyncAt            DateTime?
  lastSyncError         String?

  @@unique([organizationId, providerId, externalRef])
}
```

### Categorias do catálogo

| Categoria | Cards | Origem |
|---|---|---|
| Bancos | Inter, Sicoob, Sicredi, BB, Itaú, Santander (Bradesco/Caixa como "Em breve") | API própria |
| Adquirentes | PagBank, Mercado Pago (Cielo/Rede/Getnet como "Só arquivo" ou "Em breve") | API própria |
| Gateways | Asaas, Stripe, Pagar.me | ver `pagamentos-gateway.md` |
| ERP | Winthor/Oracle | ✅ existe |
| Fiscal | Focus NFe | ✅ existe |
| Produtividade | Google Drive | ✅ existe |

Bandeira (Visa/Master/Elo) **não vira card** — bandeira não fala com lojista, o dado é da adquirente.

---

## Decisoes tomadas

- **Só conector direto com API própria do provedor — sem agregador.** Decisão do dev em 29/08/2026. Consequência aceita: cada banco é um projeto de integração, o cliente precisa ter credencial daquele banco, e o catálogo cresce provedor a provedor em vez de abrir com todos de uma vez.
- **O catálogo mostra provedor sem conector, marcado "Em breve"** — permite abrir com o catálogo cheio sem prometer o que não existe. Card "Em breve" não abre formulário.
- **Card declara o pré-requisito antes do formulário** — Stone exige parceria, Bradesco exige e-mail ao banco, Getnet vende a conciliação à parte. Deixar o usuário descobrir isso depois de preencher o formulário é o pior desfecho possível.
- **PR 1 = catálogo + um conector real ponta a ponta.**
- **O conector da PR 1 é o Banco Inter** — *substitui a escolha anterior (Mercado Pago), pela pesquisa*: o Inter é o único banco 100% autosserviço (o cliente gera credencial e certificado sozinho no Internet Banking) **e** exercita o caminho de autenticação mais difícil e mais reaproveitável — OAuth2 client_credentials + mTLS + upload de certificado. Resolvido o Inter, Sicoob, Sicredi, Itaú e Santander são variações do mesmo `http-mtls.ts`. Mercado Pago e PagBank, que são só token, entram baratos logo depois.
- **Certificado vai no blob cifrado, não no bucket privado** — mudança em relação ao desenho inicial. Um par `.crt`/`.key` tem poucos KB: guardá-lo no mesmo AES-256-GCM das outras credenciais evita uma segunda superfície de ACL e um segundo modo de falha, e mantém "as credenciais de uma integração" num lugar só. A coluna `certificateKey` fica reservada para provedor que um dia exija artefato grande demais para o blob; `certificateExpiresAt` continua em uso, alimentando o aviso de vencimento.
- **Arquivo EDI é caminho primário de cartão, não fallback** — reordenação de 29/08/2026. O suporte a EDI subiu da Fase 3 para a Fase 2, junto do NSU, porque é o par que destrava conciliação de cartão para cliente de Cielo, Rede, Stone e Getnet — a maioria. Deixar EDI por último entregaria um módulo que só concilia quem usa PagBank ou Mercado Pago.
- **A PR 1 não persiste movimento financeiro** — busca e mostra prévia dos últimos 30 dias, e para aí. Gravar lançamento depende de `financeiro-contas.md` decidir `FinancialAccount`/`Transaction` vs `PaymentBankAccount`/`PaymentEntry`, decisão em aberto; antecipar aqui criaria a terceira verdade sobre "conta".
- **Logo em `public/integracoes/`, não em `public/brands/`** — `brands/` é marca de fornecedor do Trade (Nestlé, Ambev); outro domínio.

---

## Criterios de aceite (PR 1)

1. `/integracoes` mostra grid por categoria; ERP, Fiscal e Drive aparecem como cards e seus painéis continuam funcionando dentro do dialog.
2. Card de provedor indisponível aparece "Em breve" e não abre formulário; card com pré-requisito mostra o aviso antes do formulário.
3. Instalar o Inter: upload de `.crt` + `.key`, `client_id`, `client_secret` e conta → "Testar conexão" passa → card vira "Instalado" e lista o extrato dos últimos 30 dias.
4. "Testar conexão" falha com credencial errada e a mensagem não contém segredo nem cabeçalho de autenticação.
5. Nenhuma resposta de procedure contém credencial em texto claro (verificar no Network).
6. Certificado com vencimento em menos de 30 dias mostra aviso no card.
7. Instalação de uma org não aparece em outra (teste de integração no formato de `tests/integration/supplier-list.test.ts`).
8. Usuário sem papel de admin vê o catálogo e não consegue instalar.
9. `pnpm check-types` e `pnpm lint` limpos.

---

## Proximos passos

1. **Fase 1 (esta PR)** — manifesto + model + migration + `SCHEMA_VERSION` + procedures (listar/instalar/testar/desinstalar) + grid + dialog + conector Inter. Entrega o insumo da conciliação bancária.
2. **Fase 2** — NSU/adquirente no `SalePayment` (dependência do `pdv-caixa`) + `auth.tipo: "ARQUIVO"` com EDI de Cielo, Rede, Stone e Getnet. É o par que destrava a conciliação de cartão.
3. **Fase 3** — PagBank EDI e Mercado Pago por API (só token, baratos) + Sicoob e Sicredi reusando o `http-mtls.ts`.
4. **Fase 4** — motor de conciliação (spec própria): casamento por valor+data+NSU, tolerância, fila de divergências e casamento manual, amarrado ao que `financeiro-contas.md` decidir.

---

## Melhorias futuras (nao urgentes)

- [ ] Webhook por provedor onde existir, no lugar de cron.
- [ ] Itaú e Santander (certificado de prazo curto) — só depois da rotina de aviso de expiração estar rodando.
- [ ] Log de auditoria de instalação/remoção por usuário.
- [ ] Catálogo aberto a integração não-financeira (marketplace, logística) — o manifesto já é agnóstico.

---

## Fontes da pesquisa

Bancos: [Inter Developers](https://developers.inter.co/) · [Sicoob Developers (sandbox conta-corrente v4)](https://docs.softensistemas.com.br/books/integracao-banco-sicoob-via-api/page/sandbox-homologacao/export/html) · [Sicredi Developers](https://developers.sicredi.com.br/public/docs/general-information) · [API de Extratos BB](https://bb.com.br/site/developers/bb-como-servico/api-extratos/) · [Itaú — credenciais e certificado dinâmico](https://devportal.itau.com.br/certificado-dinamico) · [Santander Empresas — API](https://www.santander.com.br/empresas/cash/api) · [Caixa — manual técnico API](https://www.caixa.gov.br/empresa/pagamentos-recebimentos/recebimentos/pix-automatico/Documents/api-pix-automatico-manual-tecnico.pdf)

Adquirentes: [PagBank — API do Extrato EDI](https://developer.pagbank.com.br/docs/api-do-extrato-edi) · [Mercado Pago — settlements report](https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-content/reports/released-money/api) · [Cielo — EDI Extrato Eletrônico](https://developercielo.github.io/tutorial/edi-extrato-eletronico) · [Rede — portal do desenvolvedor](https://developer-portal-dev.useredecloud.com.br/credenciamento) · [Stone — credenciais da API de Conciliação](https://conciliacao.stone.com.br/docs/credenciais) · [Getnet — autenticação e identificadores](https://developers.getnet.com.br/faq/rmh7gfa5epv6xf31mkqdrnaa)
