# Como solicitar melhorias de forma eficiente

> Guia pratico para formular requisicoes que o Claude execute sem parar para perguntar.

---

## Estrutura da solicitacao

Uma boa solicitacao tem 3 partes:

```
1. ONDE  — qual feature / pagina / modulo
2. O QUE — o problema ou o que quer mudar
3. COMO  — o resultado esperado (como deveria funcionar)
```

A terceira parte e a mais importante. Sem ela, eu preciso adivinhar.

---

## Formatos por tipo de solicitacao

### Bug / Correcao

```
Na [pagina/feature], quando [acao do usuario], acontece [comportamento errado].
O correto seria [comportamento esperado].
```

Exemplo:
> Na pagina de fornecedores, quando clico em excluir, o botao nao desabilita
> e da pra clicar varias vezes. O correto seria desabilitar o botao e mostrar
> spinner enquanto processa.

### Melhoria de UX

```
Na [pagina/feature], [o que incomoda ou falta].
Quero que [como deveria ficar].
```

Exemplo:
> Na listagem de fornecedores, nao aparece o logo. Quero que mostre o avatar
> do logo na primeira coluna da tabela, como ja funciona na listagem de produtos.

### Nova funcionalidade dentro de feature existente

```
Na [feature], preciso de [funcionalidade].
Ela deve [comportamento], porque [motivo/pilar do Orbita que atende].
```

Exemplo:
> Na negociacao de espacos, preciso de um historico de quem ocupou aquele ponto.
> Deve mostrar industria, periodo e valor, porque a industria precisa ver o
> historico antes de negociar (pilar Industria — ROI de Trade).

### Refatoracao / Qualidade

```
Em [arquivos], [o que esta ruim].
Quero [como deveria ficar].
```

Exemplo:
> Em add-supplier.tsx e edit-supplier.tsx, 90% do codigo e duplicado.
> Quero um SupplierForm compartilhado que os dois usem.

---

## O que acelera a execucao

| Voce inclui | Eu ganho |
|-------------|----------|
| Nome da pagina ou URL (`/fornecedores`) | Localizo direto no MAPA-PROJETO.md |
| Print ou descricao visual | Entendo o estado atual sem navegar |
| Referencia a um spec (`ver specs/fornecedores.md`) | Leio o contexto em 2 segundos |
| "Como funciona em [outra pagina]" | Tenho o padrao a seguir |
| "Nao mexa em [X]" | Evito retrabalho |

## O que me faz parar para perguntar

| Voce diz | Eu preciso perguntar |
|----------|---------------------|
| "Melhora os fornecedores" | Melhorar o que? UX? Performance? Seguranca? |
| "Arruma o mapa" | Qual mapa? Editor? Viewer? Mapa de campo? |
| "Faz igual o concorrente" | Nao conhego o concorrente — descreva o comportamento |
| "Da uma olhada nisso" | Olhar o que? Se tem bug? Se pode melhorar? |

---

## Dica: use o spec como backlog

Se voce tem varias melhorias para uma feature, a forma mais eficiente e:

1. Me peca para **criar o spec** da feature (ex: "cria spec para planograma")
2. Eu analiso o codigo e listo tudo que encontro (bugs, UX, qualidade)
3. Voce **prioriza** os itens ("faz o item 1 e 3, o 2 deixa pra depois")
4. Eu executo direto, sem precisar explorar de novo

Isso funciona especialmente bem para features complexas como mapa, planograma,
negociacao de espacos, etc.

---

## Exemplos completos

### Bom (executo direto)

> No ranking (/ranking), a foto do vendedor nao aparece no card do board.
> O campo `image` ja volta do router. Quero que mostre um Avatar com a foto,
> com fallback para as iniciais do nome, igual ao que ja funciona na sidebar.

### Otimo (executo sem nenhuma duvida)

> Ver specs/fornecedores.md, secao "UX e validacao", item "Logo nao exibida".
> Faz esse item — o `list` ja retorna `logo`, so falta mostrar na tabela.
> Referencia: a listagem de produtos ja mostra thumbnail, usa o mesmo padrao.

### Ruim (preciso parar e perguntar)

> Melhora a tela de fornecedores.
