# Astro — Fase 4: imagens que entram, imagens que saem, e a web

> A pessoa anexa uma foto na conversa e o Astro lê. Ele gera arte quando pedem, guarda no acervo da empresa e oferece pôr no produto. E consulta a web para o que não está no sistema, citando a fonte. Fase 4 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/features/astro/server/{anexos,gerar-imagem}.ts` + `src/features/astro/server/tools/{imagens,busca-web}.ts` + `packages/astro-widget`
> Branch: `feat/astro-fase-4-imagens-web` (empilhada por patch sobre as fases anteriores, todas sem commit)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Até a Fase 3 a conversa era só texto. Agora ela carrega arquivo nos dois sentidos — e um arquivo tem uma pergunta que texto não tem: **de onde ele veio**.

Arquivos principais:
- `src/features/astro/server/anexos.ts` — a conferência do anexo. Módulo neutro: a tela usa a mesma lista de tipos para não deixar escolher o que o servidor vai recusar.
- `src/features/astro/server/gerar-imagem.ts` — a única parte que fala com o provedor de imagem. Separada para o teste poder dublá-la.
- `src/features/astro/server/tools/imagens.ts` — a tool `gerarImagem`, com cota diária.
- `src/features/astro/server/tools/busca-web.ts` — `google_search` e `url_context`, executadas pelo provedor.
- `src/features/astro/lib/anexar.ts` — o upload do lado da tela.
- `packages/astro-widget/src/astro-widget.tsx` — clipe, colar, arrastar, miniaturas e imagem na conversa.

---

## O que foi feito

- [x] **Anexo com dono**. Um anexo só vale se o endereço estiver dentro de `https://<bucket>/<orgId>/`. O histórico inteiro é postado pelo navegador a cada mensagem: sem essa regra, uma mensagem forjada faria o servidor ler a foto de outra empresa — ou qualquer URL da internet. Fora isso: JPEG, PNG ou WebP, no máximo 4 por mensagem.
- [x] **Upload pelo caminho de sempre**: assinatura em `/api/s3/upload`, PUT direto no R2. A rota ganhou um campo `pasta` (formato fechado `^[a-z0-9-]{1,20}$`), então o anexo nasce em `<orgId>/astro/…` — dentro do prefixo, que continua sendo quem decide a posse do objeto.
- [x] **`safeValidateUIMessages`** antes de a conversa virar prompt. O argumento de cada tool não é conferido ali, e nem precisa: quem o valida é o `inputSchema` dela, na execução.
- [x] **Visão em resolução média** (`providerOptions.google.mediaResolution`), e só quando há anexo. Alta multiplica os tokens de visão por imagem, e para ler rótulo, gôndola e nota fiscal a média resolve.
- [x] **`gerarImagem`** (5 ★, cota de 20/dia por organização): `generateImage` com `gemini-2.5-flash-image`, arquivo gravado em `<orgId>/astro/`, cartão de imagem na conversa e o convite para `adicionarImagemAoProduto`. A cota é contada nas linhas de `AstroAcao` do dia — sem tabela nova, e o que conta é imagem que saiu.
- [x] **`adicionarImagemAoProduto` reconhece o que já é da casa**: endereço dentro do prefixo da organização vira chave direto, sem uma segunda cópia do mesmo arquivo no bucket. É por aí que o anexo da conversa e a imagem gerada viram foto de produto.
- [x] **Busca na web** `google_search` + `url_context`, com esses nomes obrigatoriamente — é assim que o provedor as reconhece. Cobrança de 1 ★ por passo que voltou com fontes, somada e debitada no fim junto com os tokens.
- [x] **Quem atende decide o que existe**: as três tools acima só entram no conjunto quando o provedor resolvido é o Google. `resolverModelo` passou a devolver `provedor` e o provedor já construído. Com a OpenAI, elas somem — melhor ausente do que presente e quebrando na primeira chamada.
- [x] **Widget**: botão de clipe, colar do teclado, arrastar para o painel, miniaturas com "×" antes de enviar, imagem renderizada na conversa (anexo da pessoa e imagem gerada). Sem a prop `enviarArquivo` nada disso aparece — o site continua igual.
- [x] **Env de visão unificada**: `identify-product-vision.ts` e `extract-offers-vision.ts` leem `GOOGLE_GENERATIVE_AI_API_KEY ?? GEMINI_API_KEY`, nessa ordem.
- [x] **Prompt**: bloco "IMAGEM E WEB" (leia a foto anexada; `gerarImagem` só quando pedirem; web só para o que não está no sistema, com a fonte pelo nome do site). Medido: **11.975 caracteres**, contra o teto de 12.000.

---

## Pendencias

### Critico
- [ ] **Testar no navegador**: anexar, colar e arrastar uma foto e ver o Astro responder sobre ela; pedir uma imagem e ver o cartão de aprovação. A suíte cobre a conferência e a execução, não o laço com um modelo de verdade.
- [ ] **Confirmar a chave do Google** no ambiente (`GOOGLE_GENERATIVE_AI_API_KEY`): sem provedor Google, as três tools desta fase não existem e o Astro segue só com texto.

### Funcional
- [ ] `search-web-images.ts` **não** foi mexido: lá `GOOGLE_GENERATIVE_AI_API_KEY` é fallback da chave do Custom Search (`GOOGLE_CSE_API_KEY`), que é outra coisa. Unificar aquilo seria trocar uma chave por outra.
- [ ] Não há cota de **espaço** para o que o Astro sobe — só a cota diária de bytes da Fase 0 e o limite de 20 imagens geradas por dia.
- [ ] Anexo continua no bucket depois da conversa. Limpeza de órfãos é a mesma pendência aberta na Fase 1.
- [ ] O pacote `@nerp/astro-widget` ainda não tem suíte própria (nem vitest configurado), então o clipe, o colar e o arrastar não têm teste de componente. Era pendência da Fase 3 e continua.

---

## Decisoes tomadas

- **O prefixo é a autorização.** Não se confere o anexo por sessão nem por tabela: confere-se o endereço. É a mesma prova de posse que a Fase 0 pôs no R2, e ela vale para um arquivo que o cliente escolheu mandar de volta no histórico.
- **Tool de provedor não se finge de tool comum.** `google_search` e `url_context` rodam dentro da chamada, sem `execute`. Por isso a cobrança da web sai de "o passo voltou com fontes", e não de uma contagem de chamadas que não existe.
- **A conta da web vem no fim, com os tokens.** Cobrar no meio do stream seria uma escrita por passo numa resposta que ainda pode falhar.
- **Gerar imagem pede o sim.** Custa ★ e produz coisa nova; entrou na mesma lista de aprovação das ações da Fase 3.
- **A cota mora na auditoria.** `AstroAcao` já grava toda ação de escrita com data; contar as linhas de hoje é mais barato que um contador próprio, e é o mesmo número que aparece no rastro.
- **O pacote não sabe subir arquivo.** Ele recebe `enviarArquivo` e devolve a parte pronta. Bucket, sessão e organização são do app — o site usa o mesmo widget e simplesmente não passa a prop.

---

## Testes

- unit: `features/astro/server/anexos.test.ts` — anexo no prefixo da organização passa; do bucket da vizinha, de endereço arbitrário e de prefixo que só *parece* o certo (`org_a2` contra `org_a`) são recusados; tipo fora da lista recusado mesmo no prefixo certo; mais de 4 recusado; sem bucket configurado nada passa; `anexosDasMensagens` colhe partes de corpo malformado sem quebrar; `chaveDoAnexo` devolve a chave só para o que já é da casa.
- unit: `features/astro/server/tools/busca-web.test.ts` — com o Google, as duas tools saem com os nomes exatos; com a OpenAI e sem modelo, o conjunto sai vazio.
- integração: `tests/integration/astro-imagens.test.ts` — `gerarImagem` (provedor dublado) grava em `<orgId>/astro/`, debita 5 ★ e grava `AstroAcao`; falha do provedor não cobra e deixa o erro no rastro; cota do dia estourada recusa sem chamar o provedor; sem provedor Google, `gerarImagem`, `google_search` e `url_context` não entram no conjunto.
