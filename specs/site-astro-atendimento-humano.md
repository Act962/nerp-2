# Astro do site — atendimento humano no Chat do Órbita

> Quando o visitante do site pede uma pessoa, a conversa passa para a equipe no
> Chat do Órbita (canal ASTRO CHAT) e as respostas voltam para o widget.
> Feature: `apps/web/src/features/astro-consultor/server/atendimento*.ts` +
> `apps/web/src/app/api/site/astro/atendimento` + `packages/astro-widget`
> Criado em: 2026-10-06 · Atualizado em: 2026-10-06
> Status: ⏸️ Mesclado na PR #123, mas sem uso se o ASTRO do Órbita assumir o site
> (ver `site-astro-chat-do-orbita.md`): a ponte é do consultor, e ele sai da página.

---

## Situacao atual

O Astro do site (`@nerp/astro-widget` → `/api/astro/chat` do site →
`/api/site/astro/chat` do `apps/web`) só tinha três saídas para "falar com
gente": o link do WhatsApp, o formulário externo e o diagnóstico gravado em
`site_leads`. Nenhuma chegava ao Chat do Órbita.

Agora há uma ponte. Ela NÃO cria rota nova no Órbita: usa a API pública do
ASTRO CHAT que já existe lá (`nasaex-wey`, spec 0031):

- `POST /api/astro-chat/<chave>/session` — emite o token do visitante;
- `POST /api/astro-chat/<chave>/messages` — grava a mensagem; na primeira, cria
  o lead com origem `ASTRO_CHAT` e a conversa no tracking do site cadastrado;
- `GET  /api/astro-chat/<chave>/messages?after=<id>` — o que veio depois.

É por isso que a conversa aparece no filtro do ASTRO do Chat sem ninguém mexer
no Órbita.

Arquivos principais:
- `apps/web/src/features/astro-consultor/server/atendimento.ts` — a ponte
  (abrir, enviar, ler). Nunca lança: falha vira `{ ok: false, motivo }`.
- `apps/web/src/features/astro-consultor/server/atendimento-texto.ts` — o texto
  do pedido e a leitura das respostas; função pura, com teste.
- `apps/web/src/features/astro-consultor/server/tools.ts` — tool `chamarEquipe`
  (só no site, só com a ponte configurada).
- `apps/web/src/app/api/site/astro/atendimento/route.ts` — `POST` (botão e
  mensagens) e `GET` (respostas).
- `apps/site/src/app/api/astro/atendimento/route.ts` — o proxy same-origin.
- `packages/astro-widget/src/astro-widget.tsx` — o modo "atendimento" (prop
  `apiAtendimento`).
- `prisma/schema.prisma` — `SiteChatSession.handoffToken` / `handoffAt`.

### Como a conversa muda de mão

1. **Pelo texto** — o visitante pede uma pessoa; o Astro chama `chamarEquipe`
   com motivo e resumo. **Pelo botão** — "Falar com uma pessoa" posta
   `{ iniciar: true }` direto, sem modelo no caminho.
2. O `apps/web` abre o visitante no ASTRO CHAT, manda o pedido e grava o token
   na sessão (`handoffToken`). O navegador nunca recebe esse token.
3. O widget entra em atendimento: o que a pessoa escreve vai para
   `POST /api/astro/atendimento`, e ele consulta `GET` a cada 4 s (parado com a
   aba escondida). Resposta da equipe entra na conversa com o nome de quem
   escreveu; com o painel fechado, o balão avisa.
4. A sessão fica com a equipe até o visitante clicar em "Nova conversa".

---

## Pendencias

### Critico

- [ ] **Cadastrar o site no ASTRO CHAT do Órbita** — app ASTRO CHAT → novo
  site "orbitatec.com.br", tracking "ATENDIMENTO ÓRBITA", domínio permitido
  `https://www.orbitatec.com.br`, **IA desligada** (senão o ASTRO do Órbita
  também responde e o visitante fala com duas IAs).
- [ ] **Variáveis no `apps/web`** (Coolify e `.env` local):
  - `ORBITA_ASTRO_CHAT_KEY` — a chave pública do site cadastrado acima. Sem
    ela a ponte fica desligada e tudo segue como era (WhatsApp e formulário).
  - `ORBITA_ASTRO_CHAT_ORIGIN` — o domínio cadastrado lá (padrão
    `https://www.orbitatec.com.br`). Tem de bater, ou a rota responde 403.
  - `ORBITA_ASTRO_CHAT_URL` — opcional; padrão `NEXT_PUBLIC_ORBITA_URL` ou
    `https://orbita.nasaex.com`.
- [ ] **Aplicar a migration** `20261006120000_site_chat_atendimento_humano`
  (`pnpm db:deploy`). Aditiva, com `IF NOT EXISTS`. O `SCHEMA_VERSION` já foi
  para `v107`.
- [ ] **Teste ponta a ponta** — não foi feito: depende da chave e do banco
  migrado. Roteiro: pedir uma pessoa pelo texto e pelo botão → conferir a
  conversa no filtro ASTRO do Chat → responder de lá → ver a resposta no widget.

### Funcional

- [ ] **Teto de visitantes novos por IP** — o ASTRO CHAT aceita 20 visitantes
  novos por hora por IP. A ponte chama do servidor e manda o IP do visitante em
  `x-forwarded-for`, mas se o proxy do Órbita sobrescrever o cabeçalho, todos
  contam como o IP do `apps/web`. Acima de 20 pedidos de atendimento por hora,
  conferir isso antes de mexer no limite.
- [ ] **Nome do lead** — a rota pública cria o lead como "Visitante do site
  #XXXX". O nome e o contato vão no texto da primeira mensagem; para irem para
  o cadastro do lead seria preciso mudar o Órbita.

### Qualidade de codigo

- [ ] **Typecheck não rodou** (regra da casa: só a pedido). Biome e unit
  passam; vale um `pnpm check-types` antes do merge, principalmente pelo widget.

---

## Decisoes tomadas

- **Só quando pedir humano** (Weydson, 2026-10-06) — conversa que não pediu
  gente não vai para o Chat. Espelhar tudo encheria o Chat de quem só estava
  olhando.
- **A resposta da equipe volta para o widget** (Weydson, 2026-10-06).
- **Ponte no servidor, não no navegador** — o token do visitante do Chat é uma
  credencial daquela conversa; fica em `site_chat_sessions`, e o navegador só
  conhece o id da sessão do site. Também é o que mantém o segredo
  `SITE_ASTRO_TOKEN` como única porta.
- **O botão não passa pelo modelo** — quem clica em "Falar com uma pessoa" não
  pode depender de uma IA decidir chamar a tool. A tool existe para quem pede
  por escrito.
- **Guarda na rota do chat** — sessão com `handoffAt` que ainda postar em
  `/api/site/astro/chat` (aba antiga) tem a mensagem repassada à equipe, e não
  respondida pelo modelo.
- **Site de pé com o Órbita fora do ar** — toda falha da ponte vira aviso no
  widget com o link do WhatsApp; o Astro continua respondendo.
- **Consulta periódica, não conexão aberta** — é o que a rota do Chat oferece e
  o que atravessa os dois proxies sem configuração.

---

## Proximos passos

1. Cadastro no Órbita + variáveis + migration.
2. Teste ponta a ponta com a equipe respondendo do Chat.
