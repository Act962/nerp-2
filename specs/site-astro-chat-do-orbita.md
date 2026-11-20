# ASTRO do Órbita no site — o código do ASTRO CHAT no admin

> Colando o código de instalação do ASTRO CHAT em `/site/melhorias`, quem atende
> em orbitatec.com.br passa a ser o ASTRO do Órbita, no lugar do consultor do site.
> Feature: `apps/web/src/features/site/server/astro-chat*.ts` +
> `apps/web/src/app/router/site/astro-chat.ts` + `apps/site/src/features/astro`
> Criado em: 2026-10-06 · Atualizado em: 2026-10-06
> Status: 🟡 Em andamento — código pronto, sem commit; falta testar com a chave real

---

## Situacao atual

O site tinha um Astro próprio (o consultor de `astro-consultor`, com busca no
catálogo, estimativa de preço, CNPJ, cartões de link e lead em `/site/leads`).
O Weydson decidiu (2026-10-06) trocar pelo ASTRO do Órbita: toda conversa do
site nasce no Chat de lá, e a inteligência é configurada num lugar só.

Como funciona:

1. O admin cola em `/site/melhorias` a linha `<script … data-key="ac_pk_…">` que
   o app ASTRO CHAT do Órbita entrega. Dela é guardada a chave
   (`site_settings`, chave `astro-chat`). Salvar testa na hora contra o Órbita.
2. `/api/site/content` passa a devolver `astro.chat = { servidor, chave }`.
3. O `apps/site`, ao ver `astro.chat`, injeta o carregador do Órbita e **não**
   desenha o consultor. Os botões "falar com o Astro" e a abertura automática
   caem no WhatsApp, porque o painel que eles abriam não está mais na página.
4. Campo em branco desfaz tudo: o consultor volta.

**Para qual organização e tracking a conversa vai** é decidido no Órbita, não
aqui: a chave identifica o site cadastrado no ASTRO CHAT, que pertence a uma
organização e tem o tracking de destino escolhido na aba "Site e destino".

Arquivos principais:
- `packages/site-content/src/astro-chat.ts` — o pedaço do contrato entre os apps.
- `apps/web/src/features/site/server/astro-chat-codigo.ts` — lê o código colado (puro, com teste).
- `apps/web/src/features/site/server/astro-chat.ts` — o que está salvo e o teste contra o Órbita.
- `apps/web/src/app/router/site/astro-chat.ts` — `site.astroChat.get` / `save`.
- `apps/web/src/features/site/components/site-astro-chat-codigo.tsx` — o cartão do admin.
- `apps/site/src/features/astro/astro-chat-do-orbita.tsx` — injeta o carregador, uma vez.
- `apps/web/scripts/gerar-base-do-astro-chat.ts` + `docs/astro-chat-orbitatec/` — instruções e bases de conhecimento para colar no Órbita.

---

## Pendencias

### Critico

- [ ] **Testar com a chave real** — colar o código em `/site/melhorias` e ver o
  ASTRO do Órbita aparecer em orbitatec.com.br. Localmente só foi conferido que
  o script entra uma vez e o consultor some (chave falsa, `apps/web` simulado).
- [ ] **Domínio permitido no Órbita** — `https://orbitatec.com.br` precisa estar
  na lista do site cadastrado. O teste do "Salvar e testar" acusa quando não está.
- [ ] **Inteligência no Órbita** — colar `docs/astro-chat-orbitatec/instrucoes.txt`
  em Instruções, cadastrar `base-1.md`, `base-2.md` e `base-3.md` como bases de
  conhecimento e marcá-las no site, com "ASTRO responde" ligado.

### Funcional

- [ ] **O que deixa de existir no site com o ASTRO do Órbita** — estimativa de
  faixa de preço, consulta de CNPJ, contexto da página, cartões de link, lead e
  diagnóstico em `/site/leads`, evento de conversão dos pixels no fecho, falas
  por página (`/site/paginas`), animações do mascote e abertura automática.
  Nada foi apagado: tudo volta ao tirar o código.
- [ ] **A ponte do atendimento humano (PR #123) fica sem uso** enquanto houver
  código salvo — ela é do consultor do site. Decidir se sai do código.

### UX

- [ ] **O cartão mora em `/site/melhorias`** a pedido do Weydson. O lugar natural
  é "Faixas do Astro" (`/site/precos`), onde está o liga/desliga do consultor.

---

## Decisoes tomadas

- **Trocar, não somar** (Weydson, 2026-10-06) — um Astro só no site. Dois
  mascotes no mesmo canto, cada um com a sua conversa, seria pior que qualquer
  um dos dois.
- **Do código colado sai só a chave** — o endereço do script é montado com o
  servidor do Órbita que vem do ambiente (`ORBITA_ASTRO_CHAT_URL`). Um campo de
  texto do admin não decide de onde o site dos visitantes baixa JavaScript, e
  código que aponta para outro servidor é recusado.
- **A chave é conferida dos dois lados** — no `apps/web` ao salvar e no
  `apps/site` ao ler, como os IDs de pixel: ela vira `<script src>` no visitante.
- **Quem decide é o site** — o `apps/web` continua mandando `astro.ativo` como
  está, e o `apps/site` é que desliga o consultor ao ver `astro.chat`. Assim um
  `apps/site` ainda antigo segue mostrando o consultor até o deploy dele.
- **Nada muda no `nasaex-wey`** — o site é só mais um cliente do ASTRO CHAT.
- **As bases de conhecimento são geradas** do `@nerp/site-content`, em pedaços
  de até 18,5 mil caracteres: o Órbita corta cada base em 20 mil e soma no
  máximo 60 mil.

---

## Proximos passos

1. Commit e PR desta branch (`feat/site-astro-chat-codigo`), quando o Weydson mandar.
2. Depois do deploy: colar o código, configurar a Inteligência no Órbita e testar.
