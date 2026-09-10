# Astro — Fase 6: chamado com o suporte, teto por organização e rastro

> Quando o problema não se resolve na conversa, o Astro abre um chamado com o time e entrega o link do WhatsApp já com a mensagem escrita. Junto vêm a última trava da fatura — teto de conversa por dia por organização — e o registro estruturado de cada ferramenta executada. Fase 6 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/features/astro/server/tools/suporte.ts` + `src/features/astro/server/teto-diario.ts`
> Branch: `feat/astro-fase-6-suporte` (empilhada por patch sobre as fases anteriores)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Faltavam três coisas para o Astro operacional ficar de pé: uma saída para gente, uma trava que o saldo de ★ não cobre, e como saber depois o que ele fez.

Arquivos principais:
- `src/features/astro/server/tools/suporte.ts` — `contatoDoSuporte` (só informa) e `contatarSuporte` (abre o chamado).
- `src/features/astro/server/teto-diario.ts` — a soma das mensagens da organização nas últimas 24 horas.
- `src/features/astro-consultor/server/orchestrator.ts` — `onToolExecutionEnd`, que vira uma linha de log por ferramenta.

---

## O que foi feito

- [x] **`contatarSuporte`**: grava um `SiteLead` com nome, empresa, e-mail e WhatsApp de quem pediu, e um briefing com organização, plano, se é conta de teste, saldo de ★, assunto, resumo e a sessão da conversa. O time chega sabendo, em vez de começar pelo "me conta o que aconteceu".
- [x] **O lead continua GLOBAL**, como o do site: as tabelas `site_*` não têm `organizationId` porque o site é um só. Quem é a empresa entra no briefing — transformá-las em tabelas por inquilino seria reaproveitar o mesmo lugar para dois significados.
- [x] **Um chamado por assunto**: reabrir o mesmo assunto atualiza o lead em vez de encher a caixa do time com cópias da mesma dor.
- [x] **O botão sai como cartão**, no mesmo formato que o widget já desenha para endereço externo: `wa.me` com a mensagem pronta, aberto em aba nova, com a conversa viva atrás. O modelo nunca escreve o endereço.
- [x] **Pede aprovação**, como toda escrita: o cartão diz exatamente o que vai para o time antes de ir.
- [x] **Custa zero ★.** Quem precisa de ajuda não paga para pedir ajuda.
- [x] **Teto diário por organização** (`astroConfig.tetoMensagensDiaPorOrg`, 0 = desligado, que é o padrão): soma o `messageCount` de TODAS as sessões do canal do app nas últimas 24 horas e devolve 429 com explicação. É a trava que faltava — o saldo de ★ só segura quando a cobrança está ligada, e o limite por sessão não vê cem conversas curtas.
- [x] **Migration** `20260911160000_fase6_astro_suporte`: índice `(organizationId, createdAt)` em `site_chat_sessions`. Sem ele, a contagem varre a tabela que mais cresce do sistema a cada mensagem. `SCHEMA_VERSION = v93-fase6-astro-suporte`.
- [x] **Log estruturado por ferramenta**: organização, sessão, nome da tool, duração e se falhou. **Sem o argumento e sem a resposta** — aquilo é a conversa da pessoa, e não tem por que ir para o log do servidor. Quem quiser o conteúdo tem `AstroAcao`, que é auditoria e fica no banco da organização.

---

## Pendencias

### Critico
- [ ] **Migration** `pnpm db:deploy` (índice em `site_chat_sessions`).
- [ ] **Nenhuma tela liga o teto diário**: hoje se configura pela chave `astro-config` em `SiteSetting`, como o resto da configuração do Astro.

### Funcional
- [ ] O chamado não notifica ninguém sozinho: ele nasce como `SiteLead` com status `NOVO` e aparece no painel de leads do site. Quem não abrir o painel só fica sabendo quando a pessoa mandar o WhatsApp.
- [ ] O log vai para `console.info`. Vira métrica de verdade quando houver um coletor — o formato já é objeto, então não precisa mudar.
- [ ] `contatarSuporte` não anexa a conversa. Só o resumo que o próprio Astro escreve, e o id da sessão para quem quiser buscar.

---

## Decisoes tomadas

- **O chamado é um lead, não uma tabela nova.** O time já trabalha o funil do site; um segundo lugar para "gente pedindo ajuda" seria um segundo lugar para esquecer de olhar.
- **O teto é por organização, não por usuário.** Quem paga a conta da API é o sistema, e o gasto se soma por empresa — um teto por pessoa seria contornado abrindo a conversa em outra conta da mesma empresa.
- **Zero desliga o teto, e zero é o padrão.** Quem não configurou não deve descobrir um limite no meio de um dia movimentado.
- **O log não guarda conteúdo.** Duração e nome de ferramenta respondem "por que demorou" e "o que ele chamou". Argumento e resposta responderiam isso também, e de quebra colocariam a conversa de um cliente no log de um servidor compartilhado.

---

## Testes

- integração: `tests/integration/astro-suporte.test.ts` — o chamado nasce com o contexto da organização no briefing e com o botão do WhatsApp já com a mensagem; o mesmo assunto de novo atualiza em vez de duplicar; conta de teste vai marcada; a ação fica em `AstroAcao` com zero ★.
- integração (mesmo arquivo): teto zero não limita; o teto soma as mensagens de todas as sessões do dia, e não de uma só; o que passou de 24 horas não conta; a conversa da vizinha não conta contra o teto desta.
