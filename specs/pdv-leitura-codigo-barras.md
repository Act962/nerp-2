# PDV — Leitura de código de barras perde bipes e não incrementa quantidade

> Correção do caminho de leitura do PDV: bipes engolidos em silêncio, quantidade que não sobe na segunda leitura, e a tela que "trava" até deslogar.
> Feature: `src/hooks/use-barcode-scan.ts` + `src/features/scanner` + `src/app/api/scanner/stream` + `src/features/sales/components/novo/create-sale` · `fix/pdv-leitura-codigo-barras`
> Criado em: 2026-09-02 · Atualizado em: 2026-09-02
> Status: 🟢 Correções implementadas — aguardando teste do dev
>
> Leitor confirmado pelo dev: **balcão (USB, emula teclado)**.
>
> Caminhos relativos a `apps/web/`.

---

## Situacao atual

Relato do cliente (org **Mercadinho Sousa**): passou quatro produtos —
`000043`, `003754`, `002203`, `003312` — e a venda fechou em **R$ 14,00**
quando deveria dar **R$ 43,00**. No detalhamento: leu um código uma vez,
como eram duas unidades leu de novo, e **"travou na hora, ficou parado"**.
Em seguida lançou outra compra e a tela **só voltou ao normal depois de
deslogar e atualizar**.

A aritmética do carrinho está correta (`Σ preço × qtd` com `round2` a cada
passo) e o servidor é autoritativo — `sales/create.ts` recalcula tudo e recusa
a venda se os pagamentos não baterem. Ou seja: a venda fechou em R$ 14,00
porque **era isso que estava no carrinho**. O problema não é o preço; são
bipes que se perdem e quantidade que não incrementa.

Quatro defeitos independentes no caminho da leitura produzem exatamente esse
relato. Os três primeiros explicam o "sumiu"; o quarto explica por que
recarregar não recupera nada.

Arquivos principais:
- `src/hooks/use-barcode-scan.ts` — leitor de balcão (emula teclado)
- `src/features/scanner/hooks/use-scanner.ts` — `EventSource` do leitor pelo celular
- `src/app/api/scanner/stream/route.ts` — SSE que entrega os códigos do celular
- `src/features/sales/components/novo/create-sale/index.tsx` — `tryScan`, carrinho, persistência
- `src/features/sales/pdv-cart-store.ts` — espelho do carrinho em `sessionStorage`
- `src/lib/orpc.ts` — client oRPC (sem tratamento de 401)
- `scripts/diagnose-pdv-preco.ts` — diagnóstico somente-leitura já escrito

---

## Pendencias

### Critico

- [x] **Reconexão do SSE descarta o que foi lido** (`src/app/api/scanner/stream/route.ts:61`) —
  a cada `start` da conexão, todo `ScannerScan` com `consumedAt: null` é marcado
  como consumido **sem ser entregue**. A intenção está comentada (não misturar
  bipes do atendimento anterior), mas o `EventSource` reconecta sozinho: queda
  de rede, timeout de proxy e o próprio `MAX_LIFETIME_MS` de 30 min derrubando
  o fluxo. Todo código lido na janela da reconexão evapora em silêncio.
  **Correção:** descartar por IDADE (ex.: `createdAt` anterior à abertura menos
  ~30 s), não "tudo que está pendente". Um bipe de dois segundos atrás é da
  venda em curso; um de dez minutos atrás não é. — ✅ 2026-09-02: descarte passou a
  filtrar por `createdAt` mais velho que `STALE_SCAN_MS` (30 s).

- [x] **Erro de scan é engolido sem aviso** (`src/features/sales/components/novo/create-sale/index.tsx:223` e `:230`) —
  as duas entradas fazem `void (async () => { if (await tryScan(code)) return; … })()`.
  Se `products.findByCode` levanta erro (401, 500, rede), a promise rejeita sem
  tratamento: nenhum toast, nenhum fallback para a busca. O operador bipa e não
  acontece nada — é o "travou, ficou parado".
  **Correção:** `try/catch` nas duas, com toast distinguindo "código não
  encontrado" de "falha ao consultar". — ✅ 2026-09-02: helper `scanOuAvisar`,
  usado também pelo Enter da busca (que antes caía no fluxo de finalizar venda).

- [x] **Sessão expirada mata o PDV em silêncio** (`src/lib/orpc.ts`) — não há
  tratamento de 401 em lugar nenhum do client. Com a sessão vencida toda
  chamada falha calada, a grade continua mostrando o cache do TanStack Query e
  a tela parece viva. Explica o "só voltou quando deslogou e entrou de novo".
  **Correção:** interceptar `UNAUTHORIZED` no `RPCLink` e mandar para o login
  (ou banner "sessão expirada, entre de novo"). Nunca falhar mudo. — ✅ 2026-09-02:
  `fetch` do `RPCLink` detecta 401 e chama `notifySessionExpired()`, que mostra
  toast persistente com ação "Entrar". Não redireciona sozinho: arrancar o
  operador da tela perderia a venda em curso.

- [x] **Dígitos vazados zeram a quantidade** (`src/hooks/use-barcode-scan.ts:17`) —
  `preventDefault` só começa depois de `BURST_CONFIRMED = 3` teclas rápidas, então
  os **três primeiros dígitos de toda leitura** chegam ao elemento focado. Se o
  foco está no campo de quantidade — que é onde ele fica depois de adicionar
  pela grade, e o campo entra com o texto **selecionado** — os dígitos
  *substituem* o valor: `setItemQuantity(id, Number("000")) = 0`. Aí o `tryScan`
  incrementa `0 + 1 = 1`. Leu duas vezes, ficou 1.
  **Correção:** bufferizar desde o primeiro dígito e desfazer o vazamento
  quando a rajada se confirmar. — ✅ 2026-09-02: `BURST_CONFIRMED` de 3 → 1 (um
  intervalo abaixo de 45 ms entre duas teclas já é inalcançável digitando), o
  estado do campo focado é fotografado antes do primeiro dígito e restaurado
  pelo setter nativo + evento `input` quando a rajada confirma. `event.repeat`
  passou a ser ignorado — tecla segurada repete na cadência de um leitor e
  virava leitura fantasma.

### Funcional

- [x] **Recuperação do carrinho está morta** (`src/features/sales/components/novo/create-sale/index.tsx:526`) —
  o efeito que SALVA está declarado antes do que RESTAURA. Na montagem,
  `saveCart([])` apaga o `sessionStorage` e só então a restauração lê — sempre
  vazio. Se a tela travou e foi recarregada, o carrinho é perdido, não
  recuperado, e o toast "Carrinho recuperado" nunca pôde aparecer.
  **Correção:** — ✅ 2026-09-02: a leitura do que há para recuperar saiu do
  efeito e passou a acontecer no PRIMEIRO render (`recuperadosRef`), então a
  ordem dos efeitos deixou de importar. Os testes atuais só cobrem a função
  pura `recoverableItems`, por isso passou batido.

- [x] **Desconto em % derruba a venda** (`src/app/router/sales/create.ts:141`) —
  `discountType` nunca chega ao servidor. O cliente calcula
  `subtotal × (1 − d/100)`; o servidor faz `subtotal − d`, tratando percentual
  como reais. Qualquer desconto em % maior que zero faz os pagamentos não
  baterem e a venda ser recusada. A coluna `Sale.discount` é `Decimal(10,2)` de
  dinheiro — receberia um percentual.
  **Correção:** enviar `discountType` e resolver o valor no servidor, que é
  quem manda no total. — ✅ 2026-09-02: `discountType` entrou no input (default
  `"value"`, que preserva o comportamento antigo de quem não mandar), o
  servidor converte percentual em dinheiro sobre o subtotal que ELE resolveu, e
  `Sale.discount` passa a guardar reais.

### UX

- [x] **Bipe duplicado sem querer lança duas unidades** (`src/features/scanner/lib/scan-dedupe.ts`) —
  leitor de balcão em modo contínuo relê o item que fica parado no feixe, e o
  operador relata que "às vezes bipa 2x sem querer". O leitor pelo celular já
  descartava releitura (900 ms); o de balcão não tinha nada.
  — ✅ 2026-09-02: a regra virou módulo compartilhado (`ehLeituraRepetida`,
  `SCAN_DEDUPE_MS`) usado pelos DOIS leitores, e o PDV carimba a leitura ANTES
  do await — dois bipes com 100 ms de diferença disparam duas consultas em
  paralelo e sem isso as duas passariam pela janela. O descarte NÃO é silencioso:
  avisa "Leitura repetida ignorada. Bipe de novo para somar 1", senão volta o
  defeito oposto (operador achando que a segunda unidade entrou).

  **Tensão a testar no balcão:** este item e o "bipei duas vezes e ficou 1" são
  o mesmo botão em dois sentidos. 900 ms cobre a repetição acidental e assume
  que a segunda unidade DE PROPÓSITO leva mais que isso (afastar e reaproximar).
  Operador muito rápido pode encostar nesse limite — o número está num lugar só
  se precisar afinar. Vale conferir também o "same code delay" da própria
  firmware do leitor, que é onde isso se resolve na raiz em modo contínuo.

- [x] **Leitor do celular pequeno demais** (`src/features/scanner/components/mobile-scanner.tsx`) —
  a câmera era um QUADRADO espremido entre cabeçalho de duas linhas, lista de
  até 8 códigos enviados e um botão de largura inteira. Sobrava pouco vídeo, e a
  mira era de 160×256 px FIXOS — num quadro grande, um selinho no meio da tela.
  Pior: o decodificador lê o frame INTEIRO, então a mira pequena ainda induzia o
  operador a encaixar o código naquela caixinha.
  — ✅ 2026-09-02: `BarcodeScanner` ganhou `fill` (padrão desligado, Shopper e
  coletor de estoque intocados), a página do leitor virou `h-dvh` com a câmera
  em `flex-1`, a mira passou a ser relativa (`38% × 84%`, com teto e piso), o
  cabeçalho virou uma linha e a lista de enviados virou uma linha com o último
  código e o total. O contador saiu de `enviados.length` (que ficava travado em
  8 pelo `slice`) para um contador próprio.

- [ ] **Bipe perdido tem de ser audível** — hoje um scan que falha é
  indistinguível de um scan que deu certo. O operador só descobre no total.
  Toast de erro + som curto de recusa; item adicionado mantém o feedback atual.

- [ ] **Estado do leitor pareado visível na tela** — quando o SSE cai e está
  reconectando, o PDV não mostra nada. Um indicador de "leitor conectado /
  reconectando" evita passar a venda inteira com o leitor mudo.

### Qualidade de codigo

- [ ] **SSE consulta o banco a cada 250 ms por aba** (`src/app/api/scanner/stream/route.ts:16`) —
  `POLL_MS = 250` por até 30 min: 4 consultas por segundo por PDV aberto. Com
  várias abas isso é pressão real no pool do Postgres, e pool esgotado trava o
  app inteiro (recarregar resolve — casa com o relato). Rever o intervalo ou
  trocar por `LISTEN/NOTIFY`.

- [x] **Teste de regressão do incremento** — ✅ 2026-09-02:
  `src/hooks/use-barcode-scan.test.tsx`, 6 casos com o relógio sob controle.
  Três deles reproduziam o defeito antes da correção: o campo focado ia de
  `"1"` para `"1003"`, os três primeiros dígitos não eram segurados, e tecla
  segurada virava leitura fantasma.

---

## Decisoes tomadas

- **O preço não é o culpado.** O servidor já é autoritativo e recusa
  divergência; a venda saiu por R$ 14,00 porque o carrinho tinha R$ 14,00.
  A hipótese de tabela de preço desatualizada fica em segundo plano — o
  `scripts/diagnose-pdv-preco.ts` a descarta ou confirma de vez, porque
  imprime os `SaleItem` reais da venda.
- **Bipe perdido nunca pode ser silencioso.** É a regra que atravessa as
  quatro correções: qualquer caminho que não adicione o item ao carrinho tem
  de avisar o operador na hora.

---

## Pergunta respondida

**A leitura foi no leitor de balcão (USB, emula teclado) ou no celular pareado
por QR?** Os dois defeitos principais são diferentes:

- celular pareado → o descarte na reconexão do SSE (Crítico #1)
- leitor de balcão → os dígitos vazados zerando a quantidade (Crítico #4)

**Resposta do dev: leitor de balcão.** Os quatro foram corrigidos de qualquer
forma — o do celular é o mesmo defeito de bipe perdido, e a org pode usar os
dois leitores.

---

## Criterios de aceite

1. Bipar o mesmo código duas vezes resulta em **quantidade 2**, com o foco em
   qualquer campo da tela (busca, quantidade, preço ou nenhum).
2. Bipe que falha por rede, sessão ou código inexistente mostra **erro
   explícito** — nunca fica em silêncio.
3. Sessão expirada leva ao login em vez de deixar a tela viva com cache velho.
4. Leitor pelo celular: código lido durante uma reconexão do fluxo **chega ao
   carrinho**; código de atendimento anterior (mais velho que a janela)
   continua sendo descartado.
5. Recarregar a página no meio da venda **recupera** o carrinho dentro da
   janela de 30 min, com o toast aparecendo.
6. Desconto em % fecha a venda com o valor certo, em vez de ser recusado.
7. `pnpm check-types`, `pnpm lint` e `pnpm test` limpos, com o teste novo de
   regressão do incremento passando.

---

## Proximos passos

1. **Dev testar no balcão com o leitor de verdade** — o teste automatizado
   cobre a heurística de tempo, mas a cadência do leitor da loja é o que
   fecha a conta.
2. Rodar `scripts/diagnose-pdv-preco.ts` contra produção e anexar a saída aqui:
   confirma nos `SaleItem` daquela venda se faltou item ou faltou quantidade.
3. Itens de UX (aviso sonoro do bipe recusado, indicador do leitor pareado) e o
   `POLL_MS` do SSE — não bloqueiam a correção, valem uma passada depois.

Verificação: `pnpm test` verde em três execuções seguidas (437 testes, 46
arquivos); `pnpm biome check` sem erro novo — os 3 de `useExhaustiveDependencies`
em `create-sale/index.tsx` já existiam na `origin/main`, no efeito de
re-resolução de preços, que não foi tocado.

---

## Melhorias futuras (nao urgentes)

- [ ] `promotionalPrice` é letra morta no PDV: `search-pdv` devolve o campo,
      mas nem o carrinho nem o resolver de preço olham para ele. Se a loja
      preencheu "preço promocional" esperando efeito no caixa, não acontece
      nada. Decidir se o campo passa a valer ou se sai da tela.
- [ ] `discount-rules.ts:132` usa `Number(tier.unitPrice ?? salePrice)`, que só
      protege contra `null`: uma faixa com `unitPrice = 0` zera o item. A tela
      não deixa gravar zero, mas import/seed/SQL deixa.
