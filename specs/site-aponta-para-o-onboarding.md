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

## Pendencias

Duas decisões que são do dev, e por isso ficaram de fora:

- [ ] **O que fazer com `/cadastro`.** Continua aberto, sem convite, com e-mail e senha. Ou vira redirecionamento para `/comecar`, ou fica como a porta de quem foi convidado. São produtos diferentes, e a escolha não é técnica.
- [ ] **O CTA principal da barra do site continua sendo o WhatsApp.** Faz sentido, se falar com gente ainda é o que fecha venda no varejo. Mas então "Começar gratuitamente" é o caminho sem atrito e talvez mereça mais destaque do que tem hoje.

---

## Decisoes tomadas

- **Trocar o destino, não o texto.** "Começar gratuitamente" já descreve o que passa a acontecer de verdade: sem senha, sem cartão, com a empresa de teste pronta.
- **O padrão dos componentes mudou junto.** Deixar `"/cadastro"` como valor padrão faria a barreira voltar sozinha na próxima tela que esquecesse de passar a prop.
