# Astro — Fase 3: o assistente que age, com aprovação na conversa

> O Astro passa a criar catálogo promocional, montar e disparar campanha de WhatsApp, marcar ação no calendário e colocar imagem em produto — cada uma parando num cartão de confirmação antes de executar, com o pedido assinado pelo servidor. Fase 3 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/features/astro/server/acoes/*` + `src/features/astro/server/tools/acoes-*.ts` + `src/features/campanhas/server/disparar.ts` + `packages/astro-widget`
> Branch: `feat/astro-fase-3-acoes` (empilhada por patch sobre as fases anteriores, todas sem commit)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Até a Fase 2 o Astro só lia. Agora ele escreve — e escrever tem duas regras que nenhuma tool decide sozinha: **a pessoa confirma no cartão** e **fica o rastro**.

Arquivos principais:
- `src/features/astro/server/acoes/aprovacao.ts` — a lista do que pede confirmação, o rótulo de cada cartão e o segredo que assina o pedido. Módulo neutro: o cliente desenha o cartão com os mesmos rótulos.
- `src/features/astro/server/acoes/registro.ts` — `executarAcao`, o envelope que executa, grava `AstroAcao` e cobra as ★ **depois** do sucesso.
- `src/features/astro/server/tools/acoes-{catalogo,campanha,calendario,produtos}.ts`.
- `src/features/campanhas/server/disparar.ts` — a reivindicação do disparo, extraída de `router/campanhas/send.ts`, que passou a chamá-la.
- `packages/astro-widget/src/astro-widget.tsx` — cartão de aprovação, botão de link e `sendAutomaticallyWhen`.

---

## O que foi feito

- [x] **Aprovação de verdade, do AI SDK 7**: `streamText({ toolApproval, experimental_toolApprovalSecret })`. O laço para na tool, o cliente desenha o cartão, e `addToolApprovalResponse` devolve o sim assinado. Sem a assinatura, um cliente que reenvia o próprio histórico com `approved: true` não executa nada. Não se usou o `tool({ needsApproval })`, que está depreciado.
- [x] **Cinco ações**: `criarCatalogoPromocional` (5 ★), `criarCampanhaWhatsapp` (5 ★), `enviarCampanhaWhatsapp` (o disparo cobra por destinatário, como sempre), `criarEventoNoCalendario` (0 ★), `adicionarImagemAoProduto` (0 ★, baixa a imagem para o bucket da organização).
- [x] **Campanha em dois passos**, cada um com o próprio sim: montar não envia nada; disparar envia. "Montei uma lista" e "mandei mensagem para 800 pessoas" não cabem no mesmo sim.
- [x] **Mesma permissão da tela**: catálogo exige `catalogo-promocional-editar`, calendário exige `canManage`, campanha exige administrador **e** conta verificada. O Astro não faz o que a pessoa não poderia fazer sozinha.
- [x] **Auditoria** (`AstroAcao`, migration `20260911140000_fase3_astro_acoes`): tool, entrada, resultado, erro e ★ cobradas. `StarTransaction` só guarda a descrição do débito, e ação de custo zero não geraria linha nenhuma lá.
- [x] **Erro volta como valor**, não como exceção: o modelo lê "não deu, e foi por isso" e explica, em vez de o stream morrer.
- [x] **Widget**: cartão azul com título, resumo do que vai acontecer e os botões "Pode fazer" / "Agora não"; estados de confirmado e recusado; botão de link quando a tool devolve um (`/catalogo-promocional/<id>`), porque o modelo nunca escreve endereço.
- [x] **Prompt**: chame a tool, não pergunte "posso?" antes — a pessoa aprova no cartão. Recusado é recusado. Reúna o que falta antes de chamar. Medido: **11.693 caracteres**, contra o teto de 12.000.

---

## Pendencias

### Critico
- [ ] **Migration** `pnpm db:deploy` (`astro_acoes`). `SCHEMA_VERSION = v91-fase3-astro-acoes`.
- [ ] **Env nova, opcional**: `ASTRO_TOOL_APPROVAL_SECRET`. Sem ela, cai no `BETTER_AUTH_SECRET` — funciona, mas separar os segredos é melhor.
- [ ] **Testar o fluxo de aprovação no navegador**: o cartão só aparece com um modelo de verdade decidindo chamar a tool. A suíte cobre a execução, não o laço.

### Funcional
- [ ] `enviarCampanhaWhatsapp` aceita o nome do template como texto; não confere contra os templates aprovados na Meta (a tool de leitura que faz isso vive no site). Template errado falha no disparo, com mensagem da Meta.
- [ ] `adicionarImagemAoProduto` só aceita endereço. Anexo enviado na conversa é a Fase 4, pelo mesmo caminho.
- [ ] Nenhuma tela lista as ações do Astro. `AstroAcao` está gravada e sem leitor.

---

## Decisoes tomadas

- **Cartão, não pergunta.** O modelo chama a tool e a pessoa decide no cartão. Deixar o modelo perguntar "posso criar?" transformaria toda ação em dois turnos e uma promessa que ele pode não cumprir.
- **Segredo que assina o pedido.** O histórico da conversa é postado pelo cliente a cada mensagem; sem assinatura, "aprovado" seria só um campo que o cliente escreve.
- **Cobrar depois do sucesso, e nunca desfazer o que foi criado.** Se o saldo acabar entre a aprovação e a cobrança, o catálogo fica e a cobrança não acontece — a próxima mensagem esbarra no pré-check de saldo. Apagar o que a pessoa aprovou seria pior.
- **`dispararCampanha` extraída, não copiada.** A reivindicação condicionada ao status é o que impede disparo em dobro; duas cópias seriam duas chances de enviar duas vezes.
- **Ações não entram na tool de leitura equivalente.** `previaDeCatalogo` mostra, `criarCatalogoPromocional` cria. Uma tool que "mostra e talvez crie" é a que cria sem querer.

---

## Testes

- unit: `features/astro/server/acoes/aprovacao.test.ts` — toda ação de escrita está na configuração, todo cartão tem título e resumo, o resumo do disparo avisa que a mensagem sai de verdade, e resumo com entrada faltando não quebra.
- integração: `tests/integration/astro-acoes.test.ts` — catálogo criado na organização da closure, sem produto da vizinha, com 5 ★ debitadas e `AstroAcao` gravada; membro sem permissão recusado, sem cobrança e com rastro do erro; critério vazio não cria catálogo; evento com fim implícito de duas horas; data inválida vira erro legível; campanha sem funil, em conta de teste, e disparo de campanha inexistente, todos recusados; imagem em produto de outra organização não encontra nada.
