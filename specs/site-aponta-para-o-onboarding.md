# O site leva ao onboarding guiado, e não ao formulário de senha

> "Começar gratuitamente" no site apontava para `/cadastro`, o formulário de e-mail e senha. Passa a apontar para `/comecar`, o onboarding guiado que a Fase 1 construiu.
> Feature: `apps/site/src/lib/api.ts` e a nav
> Branch: `fix/site-aponta-para-o-onboarding` (sobre `feat/astro-economia-de-tokens`)
> Criado em: 2026-09-11 · Status: 🟡 Em andamento

---

## Situacao atual

O épico inteiro existiu para derrubar a barreira de entrada, e a barreira continuava de pé para quem vinha do site — que é por onde o cliente chega.

O caminho era este:

| origem | botão | destino | o que acontecia |
|---|---|---|---|
| site | Entrar | `/login` | certo |
| site | Começar gratuitamente | `/cadastro` | formulário com senha |
| app, home própria | Começar agora | `/comecar` | o onboarding novo |

Só quem digitava o endereço do app direto encontrava o wizard. Vindo de orbitatec.com.br, ninguém encontrava.

---

## O que foi feito

- [x] `APP_LINKS.signup` passa a ser `${APP_URL}/comecar`.
- [x] O padrão dos componentes da órbita (`Nav`, `OrbitaExperience`) também: quem renderizar sem passar `signupHref` cai no onboarding, e não no formulário.
- [x] A nav das páginas internas mandava "Começar gratuitamente" para o **login**. Agora recebe `signupHref` por prop e leva ao onboarding — quem está lendo sobre uma ferramenta ainda não tem conta.
- [x] A prop viaja pelo servidor (`pagina-interna`, `section-index`, `product-page`), e não por import: `lib/api.ts` é `server-only`, e importá-lo de um componente de cliente quebraria a build. Foi o primeiro caminho tentado, e o compilador pegou.

Conferido no navegador, com o site e o app de pé: na home e em `/solucoes` o botão aponta para `/comecar`, e a rota abre o primeiro passo do wizard ("Qual é o seu ramo?").

---

## O ramo que não está na lista

Os seis ramos vieram do site, e quem não é nenhum deles só tinha "Pular" — que
é dizer "não quero responder", e não "sou de um ramo que não está aí". A
segunda é uma resposta, e jogá-la fora custava duas coisas: a pessoa terminava
sem nenhuma solução marcada, então o guia do dashboard nascia vazio justamente
para quem mais precisaria dele; e perdia-se o único sinal que diria quais
pacotes de exemplo vale construir depois.

- [x] **Cartão "Outro ramo"**, com um campo curto e opcional para escrever o
  que a empresa faz. `Organization.niche` é texto livre, então o que a pessoa
  escreve é o que fica gravado — "pet shop", e não o rótulo do botão.
- [x] **"Outro" pré-marca o conjunto padrão** (produtos, estoque, catálogo,
  WhatsApp e o Astro), que serve a quase qualquer negócio que vende algo.
- [x] **"Pular" também pré-marca**, pelo mesmo motivo: guia vazio é a tela
  dizendo "vire-se".
- [x] **O servidor repete a rede de segurança**: chegando sem interesse
  nenhum, aplica o padrão. A tela pode mudar; a garantia fica no servidor.
- [x] O texto é limpo antes de ir ao banco — sem caractere de controle, espaço
  colapsado e cortado no tamanho da coluna.

### As soluções passam a definir o segmento

Quando o ramo não responde — "Outro" ou pulado —, quem define o segmento são as
soluções marcadas. Elas não dizem o que a empresa é, mas dizem o que ela quer
usar, e isso já separa quem opera loja própria de quem trabalha o ponto de
venda dos outros.

| o que foi marcado | segmento | por quê |
|---|---|---|
| PDV, catálogo, QR Preço, pedidos | `VAREJO` | opera a própria loja |
| trade, book, TradeGram, planograma, ranking — **sem** estoque | `INDUSTRIA` | trabalha o PDV e não segura mercadoria |
| os mesmos, **com** estoque | `DISTRIBUIDOR` | trabalha o PDV e segura mercadoria |
| empate, ou só o que serve a todos | `OUTRO` | sem sinal — e `OUTRO` não esconde nada |

O segmento decide `SEGMENT_DEFAULT_DISABLED`, ou seja, quais módulos nascem
escondidos. Deduzir mal não bloqueia nada, mas esconder no primeiro minuto o
que a pessoa quer ver é a pior primeira impressão possível — por isso a regra
é conservadora e o empate devolve `OUTRO`.

**Agência nunca é deduzida.** Indústria e agência usam as MESMAS telas, e nada
nas soluções separa as duas; o que separa de verdade é ter mercadoria, e isso
a escolha de Estoque responde. Como `AGENCIA` é o segmento que mais esconde
(tira produtos e estoque), chutá-lo sairia caro.

A tela também parou de mandar `VAREJO` fixo no "Outro": mandar um chute de lá
atropelaria a dedução do servidor.

### O wizard deixa de ignorar quem muda de ideia

- [x] **Trocar o ramo volta a valer.** A sugestão só era aplicada com a lista
  vazia, e ela nunca mais ficava vazia — quem escolhia "Supermercados",
  voltava e escolhia "Clínicas" seguia com o conjunto do supermercado. Agora o
  ramo manda enquanto ninguém mexeu na lista com a própria mão, e para de
  mandar no instante em que alguém mexe.
- [x] **O passo 2 diz por que veio marcado**: "já marcamos o que costuma servir
  a clínicas — desmarque o que você não usa". Antes a pré-marcação aparecia do
  nada.
- [x] **Desmarcar tudo deixou de ser surpresa.** O servidor repõe o básico para
  o guia não nascer vazio, e agora a tela avisa disso antes, em vez de a pessoa
  descobrir no painel.
- [x] **O rótulo do botão parou de mentir.** Ele alternava para "Pular e
  começar" quando nada estava marcado, mas o resultado era o mesmo dos dois
  jeitos. Durante a criação vira "Montando sua empresa…", porque semear a
  empresa de teste leva alguns segundos.
- [x] **A promessa do passo 1 virou verdade.** Dizia que a empresa nasce "com
  um catálogo do seu jeito", e o pacote de exemplo é o mesmo para todo ramo.
  Agora diz o que o ramo faz de fato: marcar as soluções certas e organizar o
  menu.

---

Uma observação que fica: **o ramo ainda não muda os dados de exemplo**. Só
existe o pacote `mercearia`, então quem escolhe "Clínicas" também recebe
produtos de mercearia. Era pendência conhecida da Fase 1 (faltam as fotos), e
significa que "Outro" não fica pior que os seis nesse ponto — fica igual.

---

## Pendencias

Duas decisões que são do dev, e por isso ficaram de fora:

- [ ] **O que fazer com `/cadastro`.** Continua aberto, sem convite, com e-mail e senha. Ou vira redirecionamento para `/comecar`, ou fica como a porta de quem foi convidado. São produtos diferentes, e a escolha não é técnica.
- [ ] **O CTA principal da barra do site continua sendo o WhatsApp.** Faz sentido, se falar com gente ainda é o que fecha venda no varejo. Mas então "Começar gratuitamente" é o caminho sem atrito e talvez mereça mais destaque do que tem hoje.

---

## Decisoes tomadas

- **Trocar o destino, não o texto.** "Começar gratuitamente" já descreve o que passa a acontecer de verdade: sem senha, sem cartão, com a empresa de teste pronta.
- **O padrão dos componentes mudou junto.** Deixar `"/cadastro"` como valor padrão faria a barreira voltar sozinha na próxima tela que esquecesse de passar a prop.
