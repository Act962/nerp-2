# Book de Imagens ORBITA — briefing e prompts para o ChatGPT

> Prompts prontos para gerar as imagens do site em **PNG com fundo transparente**.
> Um pedido = uma imagem. Cole o bloco de estilo correspondente + o prompt específico.
> Cobre a página `/solucoes/operacoes` e as 18 páginas individuais de ferramenta.
>
> **São dois estilos diferentes — não misture:**
> - **BLOCO DE ESTILO A** (ilustrações): traço fino claro sobre transparente → símbolos, cenas, trajetórias, benefícios
> - **BLOCO DE ESTILO B** (mockups de tela): painel escuro flutuando → as telas de cada ferramenta

---

## COMO USAR (leia antes de começar)

1. **Um pedido por imagem.** Nunca peça duas imagens na mesma mensagem — o modelo
   mistura os estilos.
2. **Sempre cole o bloco de estilo antes do prompt específico** (A para ilustração,
   B para mockup). Ele é o que mantém as 200+ imagens parecendo da mesma família.
   Use **conversas separadas** para ilustrações e para mockups: o modelo contamina
   um estilo com o outro quando os dois convivem no mesmo chat.
3. **Gere primeiro a imagem `orbita-tracking-simbolo.png`.** Quando ela sair boa,
   **anexe essa imagem** nos pedidos seguintes e escreva: *"mesmo estilo, mesma
   paleta e mesma espessura de traço da imagem anexa"*. Isso vale mais que qualquer
   descrição para manter consistência.
4. **Transparência:** peça explicitamente e confira o resultado. Se vier com fundo
   branco, responda *"refaça com fundo 100% transparente, canal alfa, sem nenhum
   fundo"*. **Nunca escreva a palavra "xadrez"** — o modelo desenha o xadrez.
5. **A arte vai sobre fundo PRETO.** Se sair com traço escuro, fica invisível no
   site. Todo traço precisa ser branco ou azul claro.
6. **Sem texto na imagem.** O modelo erra letras em português. Todo texto entra
   depois, em HTML, pelo João.
7. **Nomeie os arquivos** conforme indicado em cada prompt — o João já vai importar
   com o nome certo.

### Formatos por tipo de imagem

| Tipo | Proporção | Tamanho | Uso |
|------|-----------|---------|-----|
| Símbolo | 1:1 | 1024×1024 | Ícone da ferramenta no card e no menu |
| Cena principal (hero) | 3:2 | 1536×1024 | Topo da página da ferramenta |
| Etapa de trajetória | 1:1 | 1024×1024 | Passos do "como funciona" |
| Ícone de benefício | 1:1 | 1024×1024 | Grid de benefícios |
| Faixa/cena larga | 16:9 | 1536×864 | Seções institucionais |
| Mockup de tela | 16:9 ou 4:3 | 1536×864 | Telas do sistema (Bloco 2) |
| Mockup de celular | 9:16 | 864×1536 | Versão mobile (Bloco 2) |

---

## BLOCO DE ESTILO A — ilustrações · cole SEMPRE antes do prompt

```
Ilustração vetorial em linha fina, estilo técnico-espacial, minimalista e moderno.

PALETA ESTRITA (não use outras cores):
- Azul #1E9BF0 — traço principal
- Azul claro #7FD0FF — brilho, realces e pontos de luz
- Branco #FFFFFF — detalhes, superfícies e destaques
- Cinza-azulado #9FB3C8 — linhas secundárias e apoio

REGRAS OBRIGATÓRIAS:
- A arte será usada sobre FUNDO PRETO. Use somente tons claros (branco e azul).
  Nunca use preto, cinza escuro, marrom ou qualquer cor escura no traço.
- Fundo 100% transparente (canal alfa). Sem fundo, sem cor de fundo, sem moldura,
  sem cartão atrás, sem sombra projetada no chão.
- Sem nenhum texto, letra, número, rótulo, logotipo ou marca d'água.
- Traço uniforme e limpo, cantos levemente arredondados, brilho azul suave nos
  pontos de luz.
- Composição centralizada, com margem livre nas bordas, sem cortar elementos.
- Estética: exploração espacial, órbitas, satélites, constelações, painéis de
  controle — sofisticado e sério, nunca infantil ou cartunesco.

Formato de saída: PNG com fundo transparente.
```

---

## BLOCO 0 — Imagens da página `/solucoes/operacoes`

### `orbita-operacoes-hero.png` — 16:9
```
Cena principal: um planeta escuro visto de cima, com vários anéis orbitais
concêntricos em azul luminoso ao redor. Sobre os anéis, pequenos satélites e
módulos geométricos flutuando em pontos distintos da órbita, cada um ligado ao
planeta por uma linha fina de luz. Sensação de sistema integrado girando em
harmonia. Vista em perspectiva levemente inclinada.
```

### `orbita-manifesto-foguete.png` — 3:2
```
Um foguete estilizado em linha fina subindo na diagonal, dividido em quatro
estágios claramente separados. Cada estágio que se solta emite um brilho azul no
ponto de desacoplamento, e o estágio seguinte acende em seguida. Uma trilha de luz
contínua conecta todos os estágios, mostrando que a subida nunca se interrompe.
Composição vertical ascendente da base esquerda ao topo direito.
```

### `orbita-automacao-fluxo.png` — 16:9
```
Uma linha de fluxo horizontal contínua em azul luminoso, com cinco nós circulares
igualmente espaçados. Cada nó contém um pictograma simples e diferente: um sinal
de entrada com seta, uma seta de avanço, um aperto de mãos, uma nota fiscal com
cifrão, e uma caixa entregue. A linha entre os nós tem pequenas partículas de luz
em movimento, indicando fluxo automático da esquerda para a direita.
```

### `orbita-stars-moeda.png` — 1:1
```
Uma estrela de quatro pontas com brilho azul intenso, flutuando no centro, cercada
por um anel orbital fino. Ao redor, pequenas estrelas menores em órbita, algumas
se dissolvendo em partículas de luz, sugerindo consumo e reposição de créditos.
Sensação de moeda energética, não de dinheiro.
```

---

# BLOCO 1 — As 18 ferramentas

> Cada ferramenta tem: **1 símbolo + 1 cena hero + 4 etapas de trajetória +
> 3 ícones de benefício = 8 imagens**. Total: 144 imagens.
> As 4 etapas podem ser pedidas juntas (uma imagem larga) ou separadas — o
> recomendado é **separadas**, uma por pedido, usando cada linha da lista.

---

## 1. ORBITA TRACKING — CRM multi-funil em kanban

**`orbita-tracking-simbolo.png`** — 1:1 · *gere esta primeiro e use como referência*
```
Símbolo de um quadro kanban visto de frente: três colunas verticais de alturas
diferentes, cada uma com dois ou três cartões retangulares empilhados. Um dos
cartões está suspenso no ar entre duas colunas, com uma trilha de luz azul mostrando
o movimento de arraste. Ícone limpo, geométrico, centralizado.
```

**`orbita-tracking-hero.png`** — 3:2
```
Um painel kanban amplo flutuando no espaço, em perspectiva isométrica, com quatro
colunas de cartões. Acima do painel, linhas de luz trazem novos cartões de fontes
diferentes (um formulário, um celular, um QR code) que pousam na primeira coluna.
Ao fundo, pequenas estrelas e um arco de órbita. Sensação de esteira organizada de
oportunidades.
```

**Trajetória — 4 imagens 1:1** (`orbita-tracking-etapa-1.png` … `-4.png`)
1. `Um funil estilizado em linha fina recebendo pontos de luz de várias direções, cada ponto entrando pelo topo largo. Representa a chegada de contatos de vários canais.`
2. `Um cartão retangular sendo etiquetado: três pequenas tags coloridas em azul se acoplam à lateral do cartão, e um pequeno medidor circular ao lado indica classificação.`
3. `Uma mão estilizada em linha fina arrastando um cartão de uma coluna para a coluna seguinte, com trilha de luz azul marcando o percurso do movimento.`
4. `Um cartão no topo de uma coluna final com um selo circular de confirmação brilhando, e pequenas partículas de luz subindo, indicando negócio ganho.`

**Benefícios — 3 imagens 1:1**
- `orbita-tracking-beneficio-1.png`: `Vários funis pequenos lado a lado, de tamanhos diferentes, conectados por uma base comum de dados representada por um cilindro de linha fina.`
- `orbita-tracking-beneficio-2.png`: `Um relógio circular com um cartão parado dentro dele e um sino de alerta acoplado na borda, indicando aviso automático de inatividade.`
- `orbita-tracking-beneficio-3.png`: `Uma planilha estilizada com uma seta de importação levando suas linhas para dentro de um quadro kanban.`

---

## 2. ORBITA CHAT — atendimento WhatsApp multi-instância

**`orbita-chat-simbolo.png`** — 1:1
```
Símbolo de dois balões de conversa sobrepostos em linha fina, o da frente com três
pontos de digitação luminosos. Um pequeno anel orbital atravessa os dois balões por
trás, integrando-os.
```

**`orbita-chat-hero.png`** — 3:2
```
Uma janela de conversa flutuante em perspectiva, com bolhas de mensagem de dois
lados, uma onda sonora de áudio e um clipe de anexo. À direita da janela, três
painéis menores se abrem lateralmente como abas acopladas: um calendário, um
documento e um formulário. Linhas de luz conectam os painéis à conversa,
mostrando que tudo acontece dentro do mesmo lugar.
```

**Trajetória — 4 imagens 1:1**
1. `Um celular estilizado de onde sai um balão de mensagem que se transforma em um cartão de contato, com trilha de luz entre os dois.`
2. `Um balão de conversa conectado por linha de luz a uma fila de pequenos avatares circulares, indicando distribuição do atendimento para a equipe.`
3. `Uma conversa com três balões e, ao lado, um painel lateral aberto mostrando um calendário e um documento acoplados.`
4. `Um balão de conversa com um selo de verificação luminoso e uma seta que sai dele em direção a um cartão de funil, indicando o avanço para a próxima etapa.`

**Benefícios — 3 imagens 1:1**
- `orbita-chat-beneficio-1.png`: `Duas antenas de transmissão lado a lado emitindo ondas concêntricas que se encontram no centro, representando dois canais de envio funcionando juntos.`
- `orbita-chat-beneficio-2.png`: `Um escudo em linha fina com um balão de conversa dentro e um caminho alternativo de luz contornando um bloqueio, indicando continuidade do atendimento mesmo com queda do canal principal.`
- `orbita-chat-beneficio-3.png`: `Vários balões de conversa organizados em colunas com pequenas etiquetas acopladas, indicando conversas classificadas.`

---

## 3. ORBITA FORMS — formulários que viram lead

**`orbita-forms-simbolo.png`** — 1:1
```
Símbolo de um formulário: uma prancheta retangular com três campos horizontais e um
botão arredondado na base, com um ponto de luz azul no primeiro campo indicando
preenchimento.
```

**`orbita-forms-hero.png`** — 3:2
```
Um formulário flutuando no espaço em perspectiva, com blocos de campo sendo
montados como peças que se encaixam vindas de cima. Da base do formulário sai uma
trilha de luz azul que termina em um cartão de funil pousando à direita.
Sensação de construção sem código e resposta virando oportunidade.
```

**Trajetória — 4 imagens 1:1**
1. `Blocos retangulares de tamanhos diferentes flutuando e se encaixando verticalmente para montar um formulário, com pontos de luz nos encaixes.`
2. `Um link estilizado (elo de corrente) emitindo ondas, com um formulário pequeno pendurado nele, indicando publicação em página pública.`
3. `Um formulário com todos os campos preenchidos por linhas de luz e um selo de envio brilhando na base.`
4. `Uma resposta de formulário se transformando em um cartão que pousa em uma coluna de kanban, com trilha de luz entre os dois.`

**Benefícios — 3 imagens 1:1**
- `orbita-forms-beneficio-1.png`: `Um cursor de mouse sobre blocos de montagem encaixados, sem nenhum símbolo de código, indicando construção visual.`
- `orbita-forms-beneficio-2.png`: `Uma folha de documento com o canto dobrado saindo de um formulário, com uma seta de exportação para baixo.`
- `orbita-forms-beneficio-3.png`: `Um campo de formulário com um selo circular de verificação luminoso ao lado, indicando validação automática do contato.`

---

## 4. ORBITA AGENDAS — agendamento com página pública

**`orbita-agendas-simbolo.png`** — 1:1
```
Símbolo de um calendário de grade com um dos dias destacado por um círculo
luminoso azul, e um pequeno ponteiro de relógio sobreposto no canto inferior
direito.
```

**`orbita-agendas-hero.png`** — 3:2
```
Um calendário flutuante em perspectiva com uma coluna de horários disponíveis à
direita, alguns slots acesos em azul e outros apagados. Um ponto de luz vem de
fora e ocupa um dos slots livres. Ao redor, pequenos avatares circulares em órbita
representam os responsáveis pela agenda.
```

**Trajetória — 4 imagens 1:1**
1. `Uma grade semanal com faixas horárias destacadas em azul, indicando janelas de disponibilidade configuradas.`
2. `Uma página estilizada com uma lista de horários disponíveis e um cursor selecionando um deles.`
3. `Um slot de horário se fechando com um selo de confirmação luminoso e uma pequena mensagem saindo dele.`
4. `Um horário confirmado no calendário conectado por trilha de luz a um cartão de contato, indicando que o agendamento virou registro no CRM.`

**Benefícios — 3 imagens 1:1**
- `orbita-agendas-beneficio-1.png`: `Três calendários pequenos lado a lado, cada um com um avatar circular acima, indicando múltiplas agendas por responsável.`
- `orbita-agendas-beneficio-2.png`: `Um sino de notificação com ondas concêntricas e um pequeno balão de conversa acoplado, indicando confirmação automática.`
- `orbita-agendas-beneficio-3.png`: `Um relógio circular com uma faixa de horários bloqueada e outra livre, indicando controle de disponibilidade.`

---

## 5. ORBITA WORKSPACES — gestão de trabalho por quadros

**`orbita-workspaces-simbolo.png`** — 1:1
```
Símbolo de um quadro dividido em quatro áreas retangulares de tamanhos diferentes,
com uma marca de tarefa concluída luminosa em uma delas e um pequeno avatar
circular acoplado em outra.
```

**`orbita-workspaces-hero.png`** — 3:2
```
Um quadro de trabalho amplo em perspectiva isométrica com colunas de tarefas.
Algumas tarefas têm subtarefas menores conectadas por linhas finas abaixo delas,
formando pequenas árvores. Avatares circulares orbitam o quadro. Um sino de
lembrete brilha no canto superior. Sensação de time organizado.
```

**Trajetória — 4 imagens 1:1**
1. `Um quadro vazio com colunas sendo criadas, cada coluna surgindo com um brilho azul na borda superior.`
2. `Um cartão de tarefa com três subtarefas menores ramificando abaixo dele por linhas finas, e um avatar circular acoplado ao topo.`
3. `Um cartão de tarefa com um balão de conversa acoplado à lateral e um sino de lembrete no canto, indicando discussão e prazo.`
4. `Um cartão de tarefa com selo de conclusão luminoso e um raio estilizado ao lado, indicando automação disparada ao concluir.`

**Benefícios — 3 imagens 1:1**
- `orbita-workspaces-beneficio-1.png`: `Um relâmpago estilizado dentro de uma engrenagem de linha fina, indicando automações com gatilho.`
- `orbita-workspaces-beneficio-2.png`: `Um calendário pequeno com cartões de tarefa pousando em dias diferentes.`
- `orbita-workspaces-beneficio-3.png`: `Dois cartões idênticos ligados por uma linha de luz espelhada, indicando tarefa compartilhada entre quadros.`

---

## 6. ORBITA PLANNER — planejamento de marketing com IA

**`orbita-planner-simbolo.png`** — 1:1
```
Símbolo de um calendário editorial com pequenas miniaturas de post em três dias, e
uma estrela de quatro pontas luminosa no canto superior direito indicando geração
por inteligência artificial.
```

**`orbita-planner-hero.png`** — 3:2
```
Um calendário mensal flutuando em perspectiva, com miniaturas de publicações
pousadas em vários dias. À esquerda, um mapa mental de linhas ramificadas conecta
ideias a partir de um núcleo luminoso, e dessas ramificações saem trilhas de luz
que viram as publicações do calendário.
```

**Trajetória — 4 imagens 1:1**
1. `Um núcleo circular luminoso com ramificações finas se abrindo em várias direções, cada ponta terminando em um pequeno círculo, representando um mapa mental de ideias.`
2. `Uma folha de briefing com linhas de texto representadas por traços e uma estrela de quatro pontas brilhando acima, indicando geração assistida.`
3. `Miniaturas de publicação sendo distribuídas em uma grade de calendário, cada uma pousando em um dia com brilho azul.`
4. `Uma publicação com uma seta de envio saindo em direção a pequenos ícones circulares de rede social, e um gráfico de barras crescente ao lado indicando métricas.`

**Benefícios — 3 imagens 1:1**
- `orbita-planner-beneficio-1.png`: `Uma paleta circular com uma tipografia estilizada e uma forma geométrica ao lado, representando identidade de marca.`
- `orbita-planner-beneficio-2.png`: `Uma imagem retangular com ferramentas de edição em linha fina orbitando ao redor (corte, brilho, camada).`
- `orbita-planner-beneficio-3.png`: `Um calendário com um elo de corrente acoplado, indicando compartilhamento por link com o cliente.`

---

## 7. ORBITA FORGE — propostas e contratos

**`orbita-forge-simbolo.png`** — 1:1
```
Símbolo de um documento com o canto dobrado e uma linha de assinatura manuscrita
estilizada na parte inferior, com um selo circular luminoso sobreposto no canto
inferior direito.
```

**`orbita-forge-hero.png`** — 3:2
```
Uma proposta comercial flutuando em perspectiva, com itens de catálogo sendo
adicionados a ela como pequenos blocos vindos da esquerda. Na base do documento,
uma assinatura luminosa está sendo traçada e um selo circular de aprovação brilha
ao lado. Sensação de fechamento de negócio.
```

**Trajetória — 4 imagens 1:1**
1. `Uma prateleira de linha fina com pequenos blocos de produto alinhados, um deles sendo retirado com trilha de luz.`
2. `Um documento sendo montado por blocos que se empilham, com valores representados por traços e um total destacado na base.`
3. `Um documento com um elo de corrente acoplado e ondas saindo dele, indicando envio por link público.`
4. `Um documento com assinatura luminosa concluída e um selo de aprovação, com pequenas partículas de luz subindo.`

**Benefícios — 3 imagens 1:1**
- `orbita-forge-beneficio-1.png`: `Vários documentos idênticos empilhados com um brilho no primeiro, indicando modelos reutilizáveis.`
- `orbita-forge-beneficio-2.png`: `Uma caneta de assinatura estilizada traçando uma linha luminosa sobre um documento.`
- `orbita-forge-beneficio-3.png`: `Um documento assinado com uma seta de luz saindo dele em direção a um quadro de tarefas, indicando entrega do histórico ao próximo setor.`

---

## 8. ORBITA PAYMENT — financeiro e cobrança

**`orbita-payment-simbolo.png`** — 1:1
```
Símbolo de duas setas circulares formando um ciclo, com um cifrão estilizado no
centro e um pequeno selo de verificação luminoso na borda.
```

**`orbita-payment-hero.png`** — 3:2
```
Um painel financeiro flutuando em perspectiva, com uma curva de fluxo de caixa
ascendente, colunas de entradas e saídas e um cartão de cobrança destacado à
direita com selo de baixa automática brilhando. Ao redor, pequenos círculos
orbitais representam contas bancárias conectadas.
```

**Trajetória — 4 imagens 1:1**
1. `Um documento de cobrança sendo emitido a partir de um contrato, com trilha de luz ligando os dois.`
2. `Uma sequência de três envelopes ou sinos em fila, cada um com uma onda de envio, representando régua de cobrança em etapas.`
3. `Um comprovante de pagamento com selo de verificação luminoso e uma seta descendo até uma linha de extrato.`
4. `Um gráfico de fluxo de caixa com a linha subindo e um selo de conciliação brilhando no ponto final.`

**Benefícios — 3 imagens 1:1**
- `orbita-payment-beneficio-1.png`: `Um documento com dois caminhos saindo dele, um com selo de aprovação e outro com um X, representando fluxo de aprovações.`
- `orbita-payment-beneficio-2.png`: `Três círculos de gateway conectados por linhas de luz a um núcleo central com cifrão.`
- `orbita-payment-beneficio-3.png`: `Uma pasta dividida em seções com etiquetas, representando centros de custo e categorias.`

---

## 9. ORBITA LINNKER — página de links com QR que capta lead

**`orbita-linnker-simbolo.png`** — 1:1
```
Símbolo de um celular vertical com três botões de link empilhados na tela, e um
pequeno QR code estilizado flutuando no canto superior direito com brilho azul.
```

**`orbita-linnker-hero.png`** — 3:2
```
Um celular flutuando em perspectiva mostrando uma página de links com quatro
botões. De cada botão sai uma trilha de luz que converge para um cartão de funil à
direita. Acima, um QR code emite ondas concêntricas sendo escaneado.
```

**Trajetória — 4 imagens 1:1**
1. `Botões retangulares empilhados sendo organizados verticalmente, um deles sendo reposicionado com trilha de luz.`
2. `Um QR code estilizado emitindo ondas concêntricas, com um celular pequeno apontado para ele.`
3. `Um toque de dedo em um botão de link, com onda de impacto luminosa saindo do ponto de contato.`
4. `Uma trilha de luz saindo de um botão e terminando em um cartão que pousa em uma coluna de funil.`

**Benefícios — 3 imagens 1:1**
- `orbita-linnker-beneficio-1.png`: `Um gráfico de barras crescente com um pequeno QR code na base, indicando estatísticas de escaneios.`
- `orbita-linnker-beneficio-2.png`: `Uma paleta de cores e um retângulo de layout ao lado, indicando personalização visual.`
- `orbita-linnker-beneficio-3.png`: `Um botão de link conectado por linha de luz a três ícones diferentes (calendário, formulário, conversa).`

---

## 10. ORBITA PAGES — construtor de landing pages

**`orbita-pages-simbolo.png`** — 1:1
```
Símbolo de uma página web em linha fina, com blocos horizontais empilhados de
tamanhos diferentes, e um dos blocos ligeiramente destacado e elevado com brilho
azul, indicando montagem por blocos.
```

**`orbita-pages-hero.png`** — 3:2
```
Uma landing page flutuando em perspectiva sendo montada por blocos que descem do
alto e se encaixam na pilha. À direita, um pequeno globo em linha fina conectado à
página por uma trilha de luz, representando domínio próprio publicado.
```

**Trajetória — 4 imagens 1:1**
1. `Uma galeria de três miniaturas de página lado a lado, uma delas destacada com brilho azul, representando escolha de modelo.`
2. `Blocos retangulares descendo e se encaixando em uma página, com pontos de luz nos encaixes.`
3. `Um globo terrestre em linha fina com um pequeno cadeado luminoso ao lado e uma trilha de luz chegando de uma página.`
4. `Uma página publicada com um gráfico de linha ascendente sobreposto no canto, indicando analytics de visitas.`

**Benefícios — 3 imagens 1:1**
- `orbita-pages-beneficio-1.png`: `Uma pilha de camadas de página com setas circulares de retorno ao lado, indicando versionamento e restauração.`
- `orbita-pages-beneficio-2.png`: `Uma lupa sobre um globo com um pequeno carrinho ou selo de aquisição, indicando busca e compra de domínio.`
- `orbita-pages-beneficio-3.png`: `Uma página sendo duplicada, com uma cópia luminosa se separando da original.`

---

## 11. ORBITA N-BOX — arquivos da organização

**`orbita-nbox-simbolo.png`** — 1:1
```
Símbolo de uma caixa cúbica aberta em linha fina, com três documentos flutuando
saindo de dentro dela em trilhas de luz azul.
```

**`orbita-nbox-hero.png`** — 3:2
```
Uma estrutura de pastas flutuando em perspectiva, organizadas em níveis
hierárquicos ligados por linhas finas. Documentos e arquivos orbitam ao redor. Um
medidor circular de armazenamento brilha ao lado, parcialmente preenchido.
```

**Trajetória — 4 imagens 1:1**
1. `Um arquivo sendo enviado para cima em direção a uma nuvem estilizada em linha fina, com trilha de luz ascendente.`
2. `Pastas organizadas em árvore hierárquica, conectadas por linhas finas, uma delas se abrindo com brilho azul.`
3. `Um arquivo com um pequeno cadeado ao lado e um olho estilizado do outro lado, representando escolha entre privado e público.`
4. `Um arquivo com um elo de corrente acoplado emitindo ondas, indicando compartilhamento por link.`

**Benefícios — 3 imagens 1:1**
- `orbita-nbox-beneficio-1.png`: `Um medidor circular parcialmente preenchido com um ícone de caixa no centro, indicando cota de armazenamento.`
- `orbita-nbox-beneficio-2.png`: `Um documento conectado por linha de luz a um cartão de funil, indicando arquivo vinculado ao processo.`
- `orbita-nbox-beneficio-3.png`: `Uma lupa sobre uma pilha de documentos com um deles destacado em azul.`

---

## 12. ORBITA ROUTE — cursos e área de membros

**`orbita-route-simbolo.png`** — 1:1
```
Símbolo de um capelo de formatura estilizado em linha fina sobre um botão de play
circular, integrados em uma única forma geométrica limpa.
```

**`orbita-route-hero.png`** — 3:2
```
Uma trilha de aprendizado ascendente no espaço: módulos representados por
plataformas circulares em alturas crescentes, ligadas por uma linha de luz azul.
Sobre algumas plataformas, um botão de play; sobre a última, um selo circular de
certificado brilhando. Pequenos avatares sobem pela trilha.
```

**Trajetória — 4 imagens 1:1**
1. `Módulos retangulares sendo empilhados em ordem, cada um contendo pequenos botões de play, representando a montagem do curso.`
2. `Uma vitrine com três cartões de conteúdo lado a lado e etiquetas de valor estilizadas por traços, representando planos de acesso.`
3. `Um avatar circular avançando por uma barra de progresso luminosa, com marcos preenchidos ao longo dela.`
4. `Um selo circular de certificado com fita, brilhando intensamente, com partículas de luz ao redor.`

**Benefícios — 3 imagens 1:1**
- `orbita-route-beneficio-1.png`: `Uma película de vídeo estilizada com uma seta de upload, indicando hospedagem de aulas.`
- `orbita-route-beneficio-2.png`: `Uma carteira ou cofre com uma seta de entrada e um cifrão, indicando monetização do conteúdo.`
- `orbita-route-beneficio-3.png`: `Um grupo de avatares circulares conectados entre si por linhas finas, representando comunidade de membros.`

---

## 13. ORBITA COMMENTS — automação de comentários do Instagram

**`orbita-comments-simbolo.png`** — 1:1
```
Símbolo de um balão de comentário com um pequeno raio estilizado dentro dele,
indicando resposta automática, e um ponto de luz azul na ponta do balão.
```

**`orbita-comments-hero.png`** — 3:2
```
Uma publicação de rede social flutuando em perspectiva com vários balões de
comentário subindo dela. Um dos balões é capturado por um feixe de luz azul e
transformado em um cartão de funil que pousa à direita. Sensação de captura
automática de oportunidade.
```

**Trajetória — 4 imagens 1:1**
1. `Uma publicação com vários balões de comentário ao redor, um deles destacado por um contorno luminoso.`
2. `Uma palavra-chave representada por uma pequena chave estilizada dentro de um balão, com um radar circular detectando-a.`
3. `Um balão de resposta automática saindo com trilha de luz em direção a um celular.`
4. `Um comentário se transformando em um cartão que pousa em uma coluna de kanban, com trilha de luz.`

**Benefícios — 3 imagens 1:1**
- `orbita-comments-beneficio-1.png`: `Um radar circular com ondas concêntricas e pequenos pontos detectados, indicando monitoramento contínuo.`
- `orbita-comments-beneficio-2.png`: `Um tambor de sorteio estilizado com pequenas esferas numeradas por pontos de luz saindo dele.`
- `orbita-comments-beneficio-3.png`: `Um sino de notificação com ondas e um balão de comentário acoplado.`

---

## 14. ORBITA SPACE STATION — escritório virtual 2D

**`orbita-spacestation-simbolo.png`** — 1:1
```
Símbolo de uma estação espacial modular vista de frente: um núcleo central
circular com quatro módulos acoplados por corredores, e pequenas antenas nas
extremidades. Geométrico e limpo.
```

**`orbita-spacestation-hero.png`** — 3:2
```
Uma estação espacial vista de cima em perspectiva isométrica, com salas e áreas
distintas ligadas por corredores: uma área de recepção, um auditório com fileiras,
uma sala de reunião redonda e uma área aberta. Pequenos avatares circulares
luminosos espalhados pelas salas, alguns com ondas de áudio ao redor indicando
conversa por proximidade.
```

**Trajetória — 4 imagens 1:1**
1. `Um avatar circular luminoso com um anel de presença ao redor, entrando por uma porta estilizada de estação espacial.`
2. `Dois avatares se aproximando, com círculos de alcance que se sobrepõem e emitem ondas de áudio no ponto de encontro.`
3. `Uma sala de reunião redonda vista de cima com avatares posicionados ao redor de uma mesa e uma tela de projeção acesa.`
4. `Um auditório visto de cima com fileiras de avatares e um palco iluminado, com um pequeno ingresso estilizado flutuando ao lado.`

**Benefícios — 3 imagens 1:1**
- `orbita-spacestation-beneficio-1.png`: `Um mapa de planta baixa em linha fina com blocos sendo posicionados por um cursor, indicando editor de mundo.`
- `orbita-spacestation-beneficio-2.png`: `Avatares circulares com indicadores de status diferentes (anel cheio, anel vazado, anel pulsante), indicando presença em tempo real.`
- `orbita-spacestation-beneficio-3.png`: `Um balcão de atendimento visto de cima com um avatar de um lado e outro chegando, com um balão de conversa acima.`

---

## 15. ORBITA ASTRO — inteligência artificial

**`orbita-astro-simbolo.png`** — 1:1
```
Símbolo de um capacete de astronauta em linha fina, com o visor refletindo uma
constelação de pontos conectados por linhas, representando inteligência
artificial. Limpo e geométrico.
```

**`orbita-astro-hero.png`** — 3:2
```
Um astronauta estilizado em linha fina flutuando no espaço, cercado por uma
constelação de nós conectados que orbitam ao redor dele. De alguns nós saem balões
de conversa pequenos. Ao fundo, um arco orbital. Sensação de assistente que conhece
todo o contexto.
```

**Trajetória — 4 imagens 1:1**
1. `Documentos e arquivos sendo absorvidos por um núcleo luminoso central, com trilhas de luz convergindo, representando base de conhecimento.`
2. `Um núcleo de constelação processando: nós internos acendendo em sequência com linhas de conexão pulsando.`
3. `Um balão de resposta saindo do núcleo em direção a um celular, com onda sonora ao lado indicando também resposta por voz.`
4. `Um cartão de cliente com histórico representado por uma linha do tempo de pontos, e o núcleo de IA conectado a ela por trilha de luz.`

**Benefícios — 3 imagens 1:1**
- `orbita-astro-beneficio-1.png`: `Três núcleos circulares diferentes conectados a um comutador central, representando escolha entre múltiplos provedores de IA.`
- `orbita-astro-beneficio-2.png`: `Uma onda sonora horizontal com um microfone estilizado em uma ponta e um alto-falante na outra.`
- `orbita-astro-beneficio-3.png`: `Uma lua e estrelas com um balão de resposta luminoso ao lado, indicando atendimento fora do horário comercial.`

---

## 16. ORBITA DISPARO — API oficial do WhatsApp

**`orbita-disparo-simbolo.png`** — 1:1
```
Símbolo de uma antena de transmissão emitindo três arcos concêntricos de onda,
com um pequeno balão de mensagem na base e um selo circular de verificação
luminoso ao lado, indicando canal oficial.
```

**`orbita-disparo-hero.png`** — 3:2
```
Uma torre de transmissão em linha fina no centro emitindo ondas concêntricas
amplas. Das ondas partem trilhas de luz que terminam em vários celulares pequenos
distribuídos ao redor. Um selo circular de verificação brilha no topo da torre,
indicando canal oficial e aprovado.
```

**Trajetória — 4 imagens 1:1**
1. `Um documento de modelo de mensagem com um selo de aprovação luminoso, indicando template aprovado.`
2. `Uma lista de contatos representada por pequenos círculos empilhados, com um filtro estilizado (funil pequeno) acima dela.`
3. `Uma antena emitindo ondas com trilhas de luz partindo em direção a vários celulares.`
4. `Um painel com um gráfico de barras e um pequeno relógio circular ao lado, indicando métricas de entrega e janela de tempo.`

**Benefícios — 3 imagens 1:1**
- `orbita-disparo-beneficio-1.png`: `Um selo circular de verificação com um escudo atrás, indicando canal oficial e seguro.`
- `orbita-disparo-beneficio-2.png`: `Um relógio circular com uma janela de tempo destacada em azul no mostrador.`
- `orbita-disparo-beneficio-3.png`: `Um gráfico de barras com um pequeno cifrão ao lado, indicando controle de custo por conversa.`

---

## 17. ORBITA RANKING DE VENDAS — metas e pódio

**`orbita-ranking-simbolo.png`** — 1:1
```
Símbolo de um pódio de três degraus em linha fina, com o degrau central mais alto
coroado por uma estrela luminosa de quatro pontas.
```

**`orbita-ranking-hero.png`** — 3:2
```
Um pódio de três posições flutuando no espaço, com avatares circulares luminosos
em cada degrau. Atrás, um painel amplo com barras de progresso de meta em alturas
diferentes e um medidor circular de percentual brilhando. Partículas de luz sobem
do pódio, sensação de celebração.
```

**Trajetória — 4 imagens 1:1**
1. `Uma planilha estilizada com uma seta de importação levando linhas para dentro de um painel de metas.`
2. `Uma barra de progresso horizontal preenchida parcialmente em azul, com um marcador de meta destacado no final.`
3. `Vários avatares circulares em uma lista vertical reordenando-se, com trilhas de luz indicando mudança de posição.`
4. `Uma tela grande estilizada em modo telão exibindo um pódio, com um alto-falante pequeno emitindo ondas ao lado.`

**Benefícios — 3 imagens 1:1**
- `orbita-ranking-beneficio-1.png`: `Um medidor circular de percentual preenchido em azul, com uma seta ascendente no centro.`
- `orbita-ranking-beneficio-2.png`: `Grupos de avatares circulares organizados em três blocos distintos, representando equipes e filiais.`
- `orbita-ranking-beneficio-3.png`: `Um calendário com quatro marcações de período diferentes destacadas em azul, indicando ranking por período.`

---

## 18. ORBITA TRADEGRAM — execução de trade marketing no PDV

**`orbita-tradegram-simbolo.png`** — 1:1
```
Símbolo de uma gôndola de supermercado vista de frente em linha fina, com três
prateleiras de produtos, e uma pequena câmera fotográfica estilizada sobreposta no
canto inferior direito com brilho azul.
```

**`orbita-tradegram-hero.png`** — 3:2
```
Uma planta baixa de loja vista de cima em perspectiva isométrica, com corredores,
gôndolas e pontas destacadas. Sobre algumas gôndolas, pequenos marcadores
luminosos com trilhas de luz subindo até uma fotografia flutuante acima da planta.
Sensação de execução comprovada em foto.
```

**Trajetória — 4 imagens 1:1**
1. `Um mapa com uma rota traçada por linha pontilhada luminosa passando por vários marcadores de loja.`
2. `Um marcador de localização com ondas de sinal ao redor e um pequeno avatar ao lado, indicando check-in em campo.`
3. `Uma câmera fotográfica estilizada capturando uma gôndola, com um flash de luz azul no momento da captura.`
4. `Um documento de relatório com miniaturas de fotos organizadas em grade, com selo de conclusão luminoso.`

**Benefícios — 3 imagens 1:1**
- `orbita-tradegram-beneficio-1.png`: `Duas gôndolas lado a lado, uma com contorno tracejado (planejado) e outra sólida (executado), com um sinal de comparação entre elas.`
- `orbita-tradegram-beneficio-2.png`: `Uma gôndola dividida em seções com uma delas destacada em azul e um medidor circular ao lado, indicando share de espaço.`
- `orbita-tradegram-beneficio-3.png`: `Uma ponta de gôndola com uma etiqueta de valor estilizada e um pequeno gráfico ascendente, indicando espaço monetizado.`

---

# BLOCO 2 — Mockups de interface (as telas de cada ferramenta)

> Estas são as imagens que mais convertem numa página de produto: a tela do
> sistema. **Atenção — usam um bloco de estilo DIFERENTE** (painel escuro, não
> traço claro). Não misture com o BLOCO DE ESTILO das ilustrações.

## ⚠️ Leia antes: o problema do texto

O ChatGPT **erra texto em português dentro de interfaces** — sai embolado,
inventado ou com letras trocadas. Isso destrói a credibilidade de um mockup.
Existem dois caminhos, e o ideal é usar os dois:

| Caminho | Quando usar | Resultado |
|---------|-------------|-----------|
| **A. Mockup gerado com texto em barras** (prompts abaixo) | Páginas de ferramentas que ainda não têm tela pronta, e imagens decorativas de fundo/perspectiva | Bonito e consistente, mas genérico — texto vira traço |
| **B. Print real dentro de moldura gerada** (§ Molduras) | Ferramentas que já existem e estão bonitas: Tracking, Chat, Workspaces, Payment, Ranking, Space Station, TradeGram, NERP | Credibilidade máxima — é o produto de verdade |

**Recomendação:** gere as molduras vazias (são 4 imagens), tire os prints reais das
telas que já existem e o João compõe print + moldura em HTML. Use o mockup gerado
(caminho A) para o resto e para as artes de apoio.

---

## BLOCO DE ESTILO B — cole SEMPRE antes dos prompts de mockup

```
Mockup de interface de software (UI) em tema escuro, estilo produto SaaS moderno,
sofisticado e limpo.

PAINEL: fundo do painel em azul-marinho muito escuro (#0B1220), bordas finas em
azul-escuro (#1B2A41), cantos arredondados, leve brilho azul na borda externa.

ELEMENTOS DA INTERFACE: cartões, botões, gráficos e destaques em azul #1E9BF0 e
azul claro #7FD0FF. Ícones e superfícies em branco #FFFFFF. Elementos secundários
em cinza-azulado #9FB3C8.

REGRA CRÍTICA DE TEXTO — a mais importante:
NÃO escreva nenhuma palavra real. Todo texto da interface deve ser representado por
BARRAS E TRAÇOS horizontais de preenchimento, em larguras variadas, no estilo
wireframe/placeholder. Nenhuma letra, número, palavra ou rótulo legível em lugar
nenhum da imagem. Ícones são permitidos; texto não.

FUNDO: fora do painel, fundo 100% transparente (canal alfa). Sem cenário, sem mesa,
sem parede, sem pessoa, sem sombra projetada no chão. Apenas o painel flutuando
isolado.

Formato de saída: PNG com fundo transparente.
```

Em cada pedido, acrescente uma destas perspectivas:
- **Frontal:** `Vista frontal reta, sem inclinação.` (melhor para o topo da página)
- **Isométrica:** `Vista em perspectiva isométrica leve, inclinada cerca de 15 graus para a direita.` (melhor para seções internas)
- **Empilhada:** `Duas telas sobrepostas em profundidade, a menor à frente e à direita, com leve deslocamento.` (melhor para mostrar dois recursos)

---

## Molduras vazias — para receber os prints reais (4 imagens)

Peça com o **BLOCO DE ESTILO B**, trocando a regra de texto por:
*"O interior da tela deve ficar 100% transparente e vazio, sem nenhum conteúdo."*

- **`moldura-notebook.png`** — 3:2 · `Um notebook aberto visto de frente em leve perspectiva, apenas o contorno do aparelho em linha fina azul e branca. A área da tela deve estar completamente vazia e transparente, como um recorte, sem nenhum conteúdo dentro.`
- **`moldura-monitor.png`** — 16:9 · `Um monitor widescreen sobre base fina, visto de frente, contorno em linha azul e branca. Área da tela completamente vazia e transparente, como um recorte.`
- **`moldura-celular.png`** — 9:16 · `Um celular vertical moderno visto de frente, contorno fino em azul e branco, cantos arredondados. Área da tela completamente vazia e transparente, como um recorte.`
- **`moldura-tablet.png`** — 4:3 · `Um tablet horizontal visto de frente, contorno fino em azul e branco. Área da tela completamente vazia e transparente, como um recorte.`

---

## Mockups por ferramenta — 3 por ferramenta (54 imagens)

Padrão: **tela principal** (frontal, topo da página) + **tela de detalhe**
(isométrica, seção interna) + **versão celular** (9:16, prova de mobilidade).

### 1. TRACKING
- `orbita-tracking-tela.png` — 16:9 frontal · `Tela de CRM em kanban: barra lateral estreita à esquerda com ícones empilhados, topo com barra de busca e avatares circulares, e área principal com quatro colunas verticais de cartões. Cada cartão tem uma barra de título, duas linhas menores, uma etiqueta colorida e um pequeno avatar circular. Uma coluna tem um cartão sendo arrastado, levemente elevado e inclinado.`
- `orbita-tracking-detalhe.png` — 4:3 isométrica · `Painel lateral de detalhe de um lead aberto sobre um kanban desfocado ao fundo: foto circular no topo, blocos de informação empilhados, uma linha do tempo vertical de eventos com pontos luminosos e etiquetas coloridas.`
- `orbita-tracking-mobile.png` — 9:16 · `Tela de celular mostrando uma coluna de kanban com três cartões empilhados, barra superior com filtro e botão flutuante circular no canto inferior direito.`

### 2. CHAT
- `orbita-chat-tela.png` — 16:9 frontal · `Tela de caixa de atendimento em três colunas: à esquerda uma lista de conversas com avatares circulares e prévia em barras, ao centro uma conversa com bolhas de mensagem alternadas dos dois lados, incluindo uma bolha com onda sonora de áudio e outra com miniatura de imagem, e à direita um painel fino com dados do contato e etiquetas.`
- `orbita-chat-detalhe.png` — 4:3 isométrica · `Uma conversa com um painel lateral acoplado aberto mostrando um calendário de agendamento dentro do próprio chat, com trilha de luz sutil ligando os dois.`
- `orbita-chat-mobile.png` — 9:16 · `Tela de celular com conversa de mensagens: bolhas alternadas, barra de digitação na base com ícones de anexo e microfone, cabeçalho com avatar circular.`

### 3. FORMS
- `orbita-forms-tela.png` — 16:9 frontal · `Tela de construtor de formulário em duas colunas: à esquerda uma paleta de blocos disponíveis representados por retângulos com ícones, à direita a área de montagem com quatro campos empilhados e um botão de envio azul na base. Um bloco está sendo arrastado da paleta para a área de montagem.`
- `orbita-forms-detalhe.png` — 4:3 isométrica · `Tela de respostas de formulário: tabela com linhas de dados em barras, e um gráfico circular pequeno no topo mostrando distribuição.`
- `orbita-forms-mobile.png` — 9:16 · `Formulário público visto em celular: quatro campos empilhados, um deles em foco com borda azul luminosa, e botão azul largo na base.`

### 4. AGENDAS
- `orbita-agendas-tela.png` — 16:9 frontal · `Tela de agendamento em duas áreas: à esquerda um calendário mensal em grade com alguns dias marcados por pontos azuis, à direita uma coluna vertical de horários disponíveis em cartões, um deles destacado com borda azul luminosa.`
- `orbita-agendas-detalhe.png` — 4:3 isométrica · `Tela de configuração de disponibilidade: uma grade semanal com faixas horárias preenchidas em azul e controles deslizantes ao lado.`
- `orbita-agendas-mobile.png` — 9:16 · `Página pública de agendamento em celular: mini calendário no topo, lista de horários em cartões abaixo e botão de confirmação azul na base.`

### 5. WORKSPACES
- `orbita-workspaces-tela.png` — 16:9 frontal · `Tela de quadro de tarefas: barra lateral com lista de quadros, área principal com quatro colunas de cartões de tarefa. Alguns cartões exibem barra de progresso, avatares circulares e um pequeno ícone de sino. Um cartão tem uma marca de conclusão luminosa.`
- `orbita-workspaces-detalhe.png` — 4:3 isométrica · `Painel de detalhe de tarefa aberto: título em barra, lista de subtarefas com caixas de seleção, algumas marcadas, área de comentários com avatares e um seletor de data.`
- `orbita-workspaces-mobile.png` — 9:16 · `Lista de tarefas em celular: cartões empilhados com caixas de seleção e avatares, cabeçalho com filtro.`

### 6. PLANNER
- `orbita-planner-tela.png` — 16:9 frontal · `Tela de calendário editorial: grade mensal onde vários dias contêm miniaturas quadradas de publicação, cada miniatura com uma faixa colorida indicando o canal. À direita, painel lateral com uma prévia de post ampliada.`
- `orbita-planner-detalhe.png` — 4:3 isométrica · `Tela de mapa mental: um nó central luminoso com ramificações curvas conectando nós menores em várias direções, sobre painel escuro.`
- `orbita-planner-mobile.png` — 9:16 · `Prévia de publicação em celular: imagem quadrada no topo, linhas de legenda em barras abaixo e ícones de rede social em linha.`

### 7. FORGE
- `orbita-forge-tela.png` — 16:9 frontal · `Tela de edição de proposta comercial: documento central com cabeçalho, lista de itens em linhas com valores alinhados à direita representados por barras, e um bloco de total destacado em azul na base. À esquerda, painel de catálogo de produtos com itens em lista.`
- `orbita-forge-detalhe.png` — 4:3 isométrica · `Tela de aceite público de proposta: documento com área de assinatura na base, um traçado de assinatura luminoso e um botão azul largo de aceite abaixo.`
- `orbita-forge-mobile.png` — 9:16 · `Proposta aberta em celular: cabeçalho, itens em lista compacta, total destacado e botão de aceite azul fixo na base.`

### 8. PAYMENT
- `orbita-payment-tela.png` — 16:9 frontal · `Painel financeiro: quatro cartões de indicador no topo, cada um com um número representado por barra grossa e uma seta de tendência. Abaixo, um gráfico de área com curva ascendente azul luminosa e, ao lado, uma tabela de lançamentos com linhas em barras e pequenas etiquetas de status coloridas.`
- `orbita-payment-detalhe.png` — 4:3 isométrica · `Tela de régua de cobrança: fluxo vertical com três etapas conectadas por linha, cada etapa em um cartão com ícone de envio e um seletor de prazo.`
- `orbita-payment-mobile.png` — 9:16 · `Extrato financeiro em celular: saldo destacado no topo, lista de lançamentos com valores à direita e etiquetas de status.`

### 9. LINNKER
- `orbita-linnker-tela.png` — 16:9 frontal · `Tela de editor de página de links em duas áreas: à esquerda o editor com lista de botões reordenáveis e controles de aparência, à direita uma prévia em formato de celular mostrando a página final com foto circular no topo e quatro botões empilhados.`
- `orbita-linnker-detalhe.png` — 4:3 isométrica · `Painel de estatísticas: gráfico de linha ascendente e três cartões de contagem, com um pequeno QR code estilizado no canto.`
- `orbita-linnker-mobile.png` — 9:16 · `Página de links vista em celular: foto circular no topo, cinco botões largos empilhados e ícones de rede social na base.`

### 10. PAGES
- `orbita-pages-tela.png` — 16:9 frontal · `Tela de construtor de landing page: painel esquerdo com biblioteca de blocos em miniaturas, centro com a página sendo montada em blocos empilhados (um bloco de destaque, um de colunas, um de preços), e um bloco sendo posicionado com guia de encaixe azul luminosa.`
- `orbita-pages-detalhe.png` — 4:3 isométrica · `Tela de publicação e domínio: campo de endereço com selo de verificação luminoso e um cartão de status de publicação ao lado.`
- `orbita-pages-mobile.png` — 9:16 · `Landing page publicada vista em celular: bloco de destaque no topo, seção de cartões no meio e botão de ação azul.`

### 11. N-BOX
- `orbita-nbox-tela.png` — 16:9 frontal · `Gerenciador de arquivos: barra lateral com árvore de pastas, área principal em grade com cartões de arquivo, cada um com um ícone de tipo e barras de nome. No topo à direita, um medidor circular de armazenamento parcialmente preenchido em azul.`
- `orbita-nbox-detalhe.png` — 4:3 isométrica · `Painel de compartilhamento de arquivo: prévia do documento, alternador entre público e privado e um campo de link com botão de cópia.`
- `orbita-nbox-mobile.png` — 9:16 · `Lista de arquivos em celular: itens empilhados com ícone à esquerda e botão flutuante de envio no canto inferior.`

### 12. ROUTE
- `orbita-route-tela.png` — 16:9 frontal · `Tela de aula: grande área de vídeo à esquerda com botão de play central e barra de progresso na base, e à direita uma lista vertical de módulos e aulas, algumas com marca de concluído luminosa e uma destacada como atual.`
- `orbita-route-detalhe.png` — 4:3 isométrica · `Vitrine de cursos: três cartões lado a lado, cada um com miniatura no topo, barras de título e um selo de valor.`
- `orbita-route-mobile.png` — 9:16 · `Área de membros em celular: vídeo no topo, lista de aulas abaixo com barra de progresso e selo de certificado.`

### 13. COMMENTS
- `orbita-comments-tela.png` — 16:9 frontal · `Tela de automação de comentários em duas áreas: à esquerda a configuração da regra em blocos verticais conectados por linha (gatilho, condição, ação), à direita a prévia de uma publicação de rede social com comentários listados abaixo, um deles destacado com contorno azul.`
- `orbita-comments-detalhe.png` — 4:3 isométrica · `Painel de sorteio: lista de participantes em avatares circulares e um cartão de resultado destacado com brilho azul.`
- `orbita-comments-mobile.png` — 9:16 · `Publicação com comentários vista em celular, um comentário destacado e uma resposta automática abaixo dele.`

### 14. SPACE STATION
- `orbita-spacestation-tela.png` — 16:9 frontal · `Tela de mundo virtual 2D visto de cima: mapa de um escritório com salas distintas, mesas, um auditório com fileiras e um balcão de recepção, tudo em traço fino sobre painel escuro. Pequenos avatares circulares luminosos espalhados, dois deles com círculos de alcance sobrepostos. Na base, uma barra de controles com ícones de microfone, câmera e tela.`
- `orbita-spacestation-detalhe.png` — 4:3 isométrica · `Janela de chamada por proximidade: quatro quadros de vídeo em grade com avatares circulares, sobre o mapa do mundo ao fundo levemente desfocado.`
- `orbita-spacestation-mobile.png` — 9:16 · `Mundo 2D visto em celular: mapa reduzido com avatares e controles circulares de movimento na base.`

### 15. ASTRO
- `orbita-astro-tela.png` — 16:9 frontal · `Tela de assistente de IA: conversa central com bolhas alternadas, uma delas contendo uma pequena tabela e um gráfico gerados; à esquerda, painel de base de conhecimento com documentos listados; no topo, um seletor de modelo em cartões. Uma constelação sutil de pontos conectados aparece atrás da conversa.`
- `orbita-astro-detalhe.png` — 4:3 isométrica · `Painel de configuração de agente: cartões de provedor de IA lado a lado, um deles selecionado com borda azul luminosa, e controles deslizantes abaixo.`
- `orbita-astro-mobile.png` — 9:16 · `Assistente em celular: conversa com bolhas, botão de microfone circular destacado na base com ondas sonoras ao redor.`

### 16. DISPARO WHATSAPP
- `orbita-disparo-tela.png` — 16:9 frontal · `Tela de envio por API oficial: à esquerda um modelo de mensagem em cartão com selo de aprovação luminoso, ao centro a lista de destinatários em linhas com avatares, à direita um painel de métricas com três indicadores e um gráfico de barras de entrega.`
- `orbita-disparo-detalhe.png` — 4:3 isométrica · `Painel de status de envio: barra de progresso ampla em azul e três cartões de contagem com ícones de enviado, entregue e lido.`
- `orbita-disparo-mobile.png` — 9:16 · `Mensagem recebida em celular com selo de conta verificada no cabeçalho e uma bolha de mensagem com botões de ação abaixo.`

### 17. RANKING DE VENDAS
- `orbita-ranking-tela.png` — 16:9 frontal · `Tela de ranking em modo telão: pódio de três posições no centro com avatares circulares luminosos, o primeiro lugar mais alto e com brilho intenso. Abaixo, lista de classificação com posições, avatares e barras de progresso de meta. No topo, um medidor circular grande de percentual.`
- `orbita-ranking-detalhe.png` — 4:3 isométrica · `Tela de metas por equipe: cartões de equipe lado a lado, cada um com barra de progresso preenchida em nível diferente e um indicador de percentual.`
- `orbita-ranking-mobile.png` — 9:16 · `Ranking em celular: pódio compacto no topo e lista de posições abaixo com avatares e barras.`

### 18. TRADEGRAM
- `orbita-tradegram-tela.png` — 16:9 frontal · `Tela de mapa de loja: planta baixa vista de cima com corredores, gôndolas e pontas em traço fino, alguns pontos marcados com indicadores luminosos azuis. À direita, painel lateral com miniaturas de fotos do ponto de venda em grade e um cartão de status de execução.`
- `orbita-tradegram-detalhe.png` — 4:3 isométrica · `Comparação de planograma: duas representações de gôndola lado a lado, uma com contorno tracejado e outra sólida, com marcadores de divergência destacados em azul entre elas.`
- `orbita-tradegram-mobile.png` — 9:16 · `Aplicativo do promotor em celular: câmera capturando uma gôndola, com rota do dia em lista abaixo e botão de check-in azul.`

---

# BLOCO 3 — O ERP (NERP) e a ponte com a suíte

> Faltava no book: o ERP aparece na página de Operações como ponte e tem página
> própria em `/solucoes/erp/nerp`. Precisa do mesmo conjunto das ferramentas.
> **Ilustrações usam o BLOCO DE ESTILO A; os mockups, o BLOCO DE ESTILO B.**

## Ilustrações (BLOCO A) — 8 imagens

**`orbita-nerp-simbolo.png`** — 1:1
```
Símbolo de uma loja vista de frente em linha fina, com toldo e vitrine, e um
pequeno anel orbital atravessando por trás dela. Dentro da vitrine, três barras de
indicador de alturas diferentes, sugerindo gestão e dados.
```

**`orbita-nerp-hero.png`** — 3:2
```
Uma loja vista em corte isométrico flutuando no espaço, com gôndolas internas, um
caixa na frente e um depósito ao fundo. De cada área sobe uma trilha de luz azul
que converge para um painel de indicadores flutuando acima da loja. Sensação de
operação física virando dado em tempo real.
```

**Trajetória — 4 imagens 1:1** (`orbita-nerp-etapa-1.png` … `-4.png`)
1. `Um produto em caixa cúbica sendo cadastrado: a caixa entra por uma trilha de luz e pousa sobre uma prateleira de linha fina, com uma etiqueta pequena acoplada à lateral.`
2. `Uma prateleira com caixas em quantidades diferentes e um medidor de nível ao lado, com uma seta de reposição apontando para a posição mais vazia.`
3. `Um caixa registrador estilizado com um cupom saindo dele em trilha de luz, e um pequeno selo fiscal luminoso ao lado do cupom.`
4. `Um painel de indicadores com uma curva ascendente e três medidores circulares, com trilhas de luz chegando da loja abaixo.`

**Benefícios — 3 imagens 1:1**
- `orbita-nerp-beneficio-1.png`: `Três prédios de loja pequenos lado a lado, ligados por linhas de luz a um único núcleo central, indicando gestão multiloja.`
- `orbita-nerp-beneficio-2.png`: `Um documento fiscal com selo de verificação luminoso e ondas de transmissão saindo dele para cima.`
- `orbita-nerp-beneficio-3.png`: `Um cofre ou carteira estilizada com setas de entrada e saída em azul, e um gráfico de fluxo pequeno ao lado.`

## Mockups (BLOCO B) — 3 imagens

- `orbita-nerp-tela.png` — 16:9 frontal · `Tela de ERP de varejo: barra lateral com ícones de módulos, topo com filtros por loja e período. Área principal com quatro cartões de indicador (venda do dia, ticket, itens, margem) representados por barras grossas e setas de tendência, abaixo um gráfico de área ascendente e, ao lado, uma tabela de produtos com colunas de estoque e preço em barras, algumas linhas com etiqueta de alerta em azul.`
- `orbita-nerp-detalhe.png` — 4:3 isométrica · `Tela de frente de caixa: à esquerda a lista de itens da venda em linhas com valores alinhados à direita, à direita um bloco grande de total destacado em azul e botões de forma de pagamento em grade, com um deles em foco.`
- `orbita-nerp-mobile.png` — 9:16 · `Painel do gestor em celular: cartão de faturamento do dia em destaque no topo, gráfico compacto abaixo e lista de lojas com barras de meta.`

## Ponte suíte ↔ ERP — 2 imagens (BLOCO A)

- `orbita-integracao-ponte.png` — 16:9 · `Dois núcleos circulares luminosos afastados, um à esquerda com a silhueta de uma loja dentro e outro à direita com um quadro kanban dentro. Entre eles, duas trilhas de luz curvas em sentidos opostos formando um ciclo contínuo, com partículas em movimento e um pequeno selo circular de segurança no ponto central da ligação.`
- `orbita-integracao-conectores.png` — 3:2 · `Um núcleo central luminoso com seis conectores em linha fina se ramificando para fora, cada um terminando em um encaixe geométrico diferente e vazio, representando integração com sistemas externos. Sem nenhum logotipo ou marca.`

---

# CHECKLIST DE PRODUÇÃO

| Bloco | Imagens | Status |
|-------|---------|--------|
| Bloco 0 — página de Operações | 4 | ☐ |
| Bloco 1 — 18 ferramentas × 8 ilustrações | 144 | ☐ |
| Bloco 2 — molduras vazias | 4 | ☐ |
| Bloco 2 — 18 ferramentas × 3 mockups | 54 | ☐ |
| Bloco 3 — ERP (NERP): 8 ilustrações + 3 mockups + 2 de integração | 13 | ☐ |
| **Total** | **219** | |

> **Ainda fora do book:** os outros produtos com página própria — OrbitaLive,
> MeuPedido, NASAEX, TradeGram (página de produto), OrbitaSystem, SelfCheckout,
> OrbitaTotem, BI e E-commerce — mais os 9 segmentos. Seguem o mesmo padrão do
> Bloco 3 (8 ilustrações + 3 mockups cada). Peça o **Bloco 4** quando quiser.

**Ordem sugerida de produção:**
1. `orbita-tracking-simbolo.png` — a referência de estilo das ilustrações. Não
   avance sem aprovar.
2. `orbita-tracking-tela.png` — a referência de estilo dos mockups. Mesma regra:
   aprove antes de seguir, e anexe nos pedidos seguintes.
3. As 4 molduras vazias + os prints reais das telas que já existem (Tracking, Chat,
   Workspaces, Payment, Ranking, Space Station, TradeGram, NERP).
4. Os 18 símbolos e as 18 cenas hero.
5. Os 54 mockups (ou só os das ferramentas sem print real).
6. As 72 etapas de trajetória e os 54 ícones de benefício.
7. As 4 imagens do Bloco 0.

**Se alguma imagem sair fora do padrão**, responda no mesmo chat:
*"Refaça mantendo exatamente o estilo da imagem de referência anexa: traço fino
azul e branco, fundo 100% transparente, sem texto."*

**Se um mockup vier com texto embolado:**
*"Refaça sem nenhuma palavra: todo texto da interface deve ser apenas barras e
traços de preenchimento, estilo wireframe."*
