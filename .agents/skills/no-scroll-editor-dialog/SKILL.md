---
name: no-scroll-editor-dialog
description: Padrão de UI/UX para popups/editores (Dialog) que NUNCA exigem rolagem — frame de altura fixa, painel compacto que mostra paleta E propriedades juntas, e preview escalado com teto. Use ao criar/ajustar qualquer modal editor (ex.: "Montar Etiqueta", editores de card, forms densos em Dialog).
metadata:
  author: nerp
  version: "2.0.0"
---

# Editor em Dialog sem rolagem

Meta: o usuário **nunca** rola dentro do popup — nem no pior caso (elemento
selecionado com todas as sub-opções abertas). Referência canônica no código:
`src/features/promotional-catalog/components/card-free-editor.tsx` ("Montar
Etiqueta") + o `DialogContent` que o hospeda em `config-panel.tsx`.

> Aprendizado real: NÃO use um toggle que esconde a paleta ao selecionar um
> elemento — vira um botão órfão e confunde ("botão inserir em cima do hide").
> O que funciona é deixar **paleta E propriedades sempre visíveis**, mas
> **compactas** o bastante para caber juntas.

## Princípios

1. **Frame de altura fixa, o Dialog nunca rola.** `DialogContent` = `flex
   flex-col` com altura fixa (use **`h-[92vh]`** — 86vh costuma faltar ~1 linha).
   Corpo do editor `flex-1 min-h-0`; rodapé de ações (salvar/confirmar) fora do
   corpo, altura natural, **sempre visível**.

2. **Duas colunas: preview (flex-1) + painel (largura fixa ~320px).** Desktop
   `md:flex-row`; mobile `flex-col`. Painel com `md:overflow-y-auto` só como rede
   de segurança — o objetivo é caber sem acioná-lo.

3. **Preview escalado por fator ÚNICO + TETO em px.** Reduzir a escala nunca
   basta se a área é grande (0.7 de algo enorme ainda é enorme). Combine
   `PREVIEW_SCALE` com um `MAX_CARD_W` (ex.: 420px). Largura e altura caem juntas
   (`h = w / aspect`) e os elementos são frações (`left: el.x*100%`), então nada
   distorce nem se reposiciona.
   ```ts
   const PREVIEW_SCALE = 0.7, MAX_CARD_W = 420;
   const cardW = Math.min(Math.min(availW, availH*aspect) * PREVIEW_SCALE, MAX_CARD_W);
   const cardH = aspect > 0 ? cardW / aspect : cardW;
   ```

4. **Paleta de inserção compacta, com rótulo só se couber sem ganhar linha.** O
   vilão de altura é o NÚMERO DE LINHAS, não o rótulo em si. Junte variáveis +
   formas + texto num grid único. Se o painel é estreito, use só ícones
   (`size="icon"`, nome no `title`). Se o painel é largo (ver princípio abaixo),
   dá pra pôr o nome embaixo do ícone (`flex-col`, `text-[10px]`, `truncate` +
   `title` pro nome completo) SEM aumentar as linhas — escolha as colunas pra
   manter a mesma contagem de linhas (ex.: 15 itens em `grid-cols-5` = 3 linhas).
   Rótulo faz falta pra descoberta; só caia no ícone-puro quando não couber.

5. **Ações secundárias em UMA linha.** "Salvar como estilo" etc.: input `flex-1`
   + botão `size="icon"` na MESMA linha, não empilhados. Cada bloco secundário
   que vira uma linha economiza ~40px.

6. **Toggles compactos.** "Fundo transparente" + cor na mesma linha
   (`justify-between`), `px-2 py-1.5`, sem card gordo.

7. **Densidade confortável, não apertada.** `gap-2`/`p-2.5` no painel; fontes de
   app (`text-xs`+), evite `text-[10px]` como base.

## Verificação obrigatória (mede, não confia no olho)

Abra o popup logado e meça o container de rolagem no **pior caso** (elemento
selecionado com a seção "Caixa/borda" LIGADA e, se houver, um retângulo com
Cantos). Deve dar `overflowBy === 0`:
```js
const scroller = [...document.querySelectorAll('h3')]
  .find(h => h.textContent.trim()==='Montar Etiqueta')?.parentElement;
({ scrolls: scroller.scrollHeight > scroller.clientHeight+1,
   overflowBy: scroller.scrollHeight - scroller.clientHeight });
```
Repita para: nada selecionado, texto selecionado, forma selecionada.

## Checklist

- [ ] `DialogContent` flex-col, `h-[92vh]`, corpo `flex-1 min-h-0`, rodapé fora.
- [ ] Preview com `PREVIEW_SCALE` **e** `MAX_CARD_W`; elementos em frações.
- [ ] Paleta de inserção só-ícones (`grid-cols-6`, nome no `title`).
- [ ] Ações secundárias em uma linha (input + botão-ícone).
- [ ] Ação primária correta em destaque no rodapé (menor escopo / menos
      destrutiva preenchida — ex.: "Salvar só para esse produto", não "todas").
- [ ] Medido `overflowBy === 0` nos 4 estados (nada / texto / forma / caixa on).

## Anti-padrões

- Toggle que esconde a paleta ao editar (vira botão órfão — rejeitado pelo dev).
- Ícone + rótulo em cada botão da paleta (empilha altura demais).
- Empilhar input + botão de "salvar estilo" em linhas separadas.
- Preview só com `scale`, sem teto em px → gigante em telas largas.
- Reduzir preview mudando W e H por fatores diferentes (distorce) ou reposicionar
  em px absolutos.
- Ação primária = maior escopo/mais destrutiva.
