# Soluções — template + conteúdo por produto

> Template espelhado na página de produto da CISS (ex. CISSPoder):
> hero → proposta de valor → MAIS/MENOS → módulos → mobile → integrações →
> diferenciais → clientes → CTA final.

---

## Template de página de produto

1. **Hero** — nome do produto + frase de efeito + imagem/mockup + CTA "Agendar Demonstração"
2. **Proposta de valor** — 1 parágrafo: para quem é e qual dor resolve
3. **MAIS / MENOS** — dois blocos em contraste (o que o cliente ganha / o que elimina)
4. **Módulos / Funcionalidades** — `ModuleGrid` de 6–9 cards com ícone + título + 2 linhas
5. **Mobile / acesso remoto** — quando aplicável
6. **Integrações** — bullets das integrações relevantes
7. **Diferenciais ORBITA** — 3 pontos fixos: implantação com metodologia NASAEX,
   suporte próximo, evolução contínua do produto
8. **CTA final** — `CtaTriple`

Abaixo, o conteúdo de cada produto neste template.

---

## `/solucoes/erp/nerp` — NERP (Orbita ERP)

- **Hero:** "NERP — o ERP que transforma sua loja em inteligência comercial."
- **Proposta de valor:** ERP completo e moderno para o varejo: vendas, PDV, estoque,
  compras, fiscal, financeiro, clientes e fornecedores em uma única plataforma web,
  multiloja e multiempresa. Mais que controlar a operação: o NERP transforma cada
  metro quadrado da loja em dado, indicador e oportunidade de receita.
- **MAIS:** agilidade no caixa · visão em tempo real · espaços da loja monetizados ·
  decisões com dados
- **MENOS:** planilhas paralelas · ruptura de estoque · retrabalho fiscal ·
  sistemas que não conversam
- **Módulos (cards):**
  | Módulo | Descrição |
  |--------|-----------|
  | Vendas e PDV | Venda ágil com atalhos de teclado, controle de caixa (abertura, sangria, fechamento) e emissão de cupom. |
  | Estoque e Inventário | Movimentações, inventário por loja, alertas de ruptura e reposição. |
  | Fiscal | Emissão NFC-e/NF-e, modelos de tributação por produto e por UF. |
  | Financeiro | Contas a pagar e receber, fluxo de caixa, conciliação e gateway de pagamentos. |
  | Compras e Fornecedores | Cadastro, cotação, importação por planilha e histórico por fornecedor. |
  | Clientes e CRM | Cadastro, histórico de compras, cupons e cashback. |
  | Catálogo Online | Loja online pública por subdomínio, carrinho e checkout — sem mensalidade de plataforma. |
  | Mapa da Loja | Planta baixa digital: gôndolas, ilhas e pontas viram ativos com histórico e ROI. |
  | Dashboard e BI | Indicadores em tempo real de vendas, metas, estoque e financeiro. |
- **Integrações:** NASAEX, WinThor, TOTVS, Oracle, SAP e APIs abertas (Orbita
  Connect) — o cliente não precisa trocar de ERP para começar.
- **Extra (seção própria):** *Trade Marketing nativo* — books fotográficos,
  planograma, promotores em campo, negociação de espaços e QR de preço para o
  shopper. Nenhum ERP de varejo entrega isso de fábrica. Link → TradeGram.

## `/solucoes/erp/orbitalive` — OrbitaLive

- **Hero:** "OrbitaLive — sua operação em tempo real, na palma da mão."
- **Proposta de valor:** acompanhamento vivo da empresa: vendas do dia, caixas
  abertos, metas, ranking de vendedores e alertas — no celular do dono e do gestor,
  onde estiverem.
- **MAIS:** visão instantânea · alertas do que importa · gestão à distância
- **MENOS:** ligar para a loja para saber o faturamento · fechar o dia às cegas
- **Módulos:** Painel do dia · Ranking de vendas · Metas por loja/vendedor ·
  Alertas (queda de venda, caixa aberto, estoque crítico) · Multi-loja
- **Nota interna:** derivado dos dashboards do NERP (`dashboard`, `org-dashboard`,
  `ranking`) empacotados como experiência mobile.

## `/solucoes/erp/meupedido` — MeuPedido

- **Hero:** "MeuPedido — do balcão à cozinha sem gritaria e sem papel."
- **Proposta de valor:** pedidos digitais para food service: o garçom registra no
  celular, a cozinha recebe no painel (tela de produção), o cliente acompanha o
  status. Integrado ao estoque e ao caixa do NERP.
- **MAIS:** pedido certo na primeira vez · cozinha organizada por status · giro de mesa
- **MENOS:** comanda de papel · erro de anotação · pedido esquecido
- **Módulos:** App do garçom · Painel de cozinha (KDS) · Acompanhamento pelo
  cliente · Cardápio digital · Integração com PDV e estoque
- **Nota interna:** apps `(waiter)` e `(pedidos-display)/painel` do NERP.

## `/solucoes/erp/nasaex` — NASAEX

> O NASAEX real (projeto `nasaex-wey`) é uma **plataforma de operação comercial**
> (CRM multi-funil + ~16 apps integrados sobre a mesma base de leads), não um ERP
> clássico. A página deve vendê-lo assim — e a landing atual do produto já tem
> copy excelente pronta (`src/app/(home)/page.tsx`, 17 seções).

- **Hero (copy real, reutilizar):** "Seu processo não devia morrer toda vez que
  muda de setor." + badge "Powered pelo Método N.A.S.A.® exclusivo"
- **Subtítulo:** "Hoje, a cada troca de mãos entre setores, alguém esquece alguma
  coisa. Você só descobre quando o cliente reclama."
- **Proposta de valor:** sistema operacional comercial: capta o lead (formulário,
  bio, Instagram), atende no WhatsApp, agenda, fecha com proposta assinada, cobra e
  entrega — tudo na mesma plataforma, com histórico contínuo entre setores.
- **Método N.A.S.A.® (stepper — copy real):**
  1. **N — Necessidade (Preparação):** recebe e organiza contatos de qualquer canal
  2. **A — Análise (Ignição):** entende quem está pronto pra comprar
  3. **S — Sistematização (Propulsão):** automações empurram o cliente de etapa em etapa
  4. **A — Ação (Em órbita):** proposta, pagamento, entrega e atendimento com histórico
- **MAIS:** processo contínuo entre setores · atendimento que não cai · IA que
  responde pelo time
- **MENOS:** print e planilha entre setores · lead esquecido · retrabalho de digitação
- **Módulos em destaque:** Tracking (CRM kanban) · Chat WhatsApp · Forge (propostas
  e contratos) · Payment · Astro (IA) · Automações — grid completo linka para
  `/solucoes/operacoes`.
- **Oferta de entrada (copy real):** "Comece por um estágio. Escolha o processo que
  mais te dá dor de cabeça. A gente monta ele inteiro, e você vê funcionando com um
  caso real antes de mexer em qualquer outra coisa. Sem cartão de crédito."
- **Planos (existem no produto — confirmar exibição no site):** Suit R$0 · Earth
  R$197 · Explore R$397 (mais popular) · Constellation R$797. Contato:
  vendas@nasaex.com.br.
- **Cross-sell:** Implantação NASAEX e Consultoria Inteligência Comercial → `/servicos`.

## `/solucoes/erp/tradegram` — TradeGram

- **Hero:** "TradeGram — a execução do seu trade marketing, comprovada em foto."
- **Proposta de valor:** plataforma que conecta indústria, distribuidor e loja na
  execução do PDV: auditorias, checklists, fotos, campanhas, pesquisas e promotores
  em campo. A indústria vê onde seu produto está — em tempo real.
- **MAIS:** execução comprovada · share de gôndola medido · ROI de campanha visível
- **MENOS:** relatório de promotor no WhatsApp · verba de trade sem prestação de contas
- **Módulos:**
  | Módulo | Descrição |
  |--------|-----------|
  | App do Promotor | Rota do dia, captura de fotos, check-in por geolocalização. |
  | Books Fotográficos | Relatórios em PDF com as fotos do PDV, prontos para enviar à indústria. |
  | Planograma | Layout ideal da gôndola vs. execução real, com comparação e alertas. |
  | Mapa da Loja | Cada gôndola e ponta com identidade digital, histórico e fila de negociação. |
  | Catálogo de Espaços | A loja vende seus espaços promocionais como mídia. |
  | Campanhas e Cupons | Ativação no PDV com cupom e cashback. |
- **Público duplo:** página fala com indústria (comprar inteligência/espaço) e com
  varejo (monetizar espaço).

---

## `/solucoes/pdv/orbitasystem` — OrbitaSystem

- **Hero:** "OrbitaSystem — frente de caixa no ritmo do seu varejo."
- **Proposta de valor:** PDV rápido, estável e operável 100% por teclado, integrado
  ao ERP: caixa, sangria, fechamento, TEF/PIX e emissão fiscal — preparado para
  operar offline e sincronizar depois.
- **MAIS:** fila andando · caixa fechando certo · operador produtivo em 1 dia
- **MENOS:** caixa travado · diferença de caixa · dependência de internet
- **Módulos:** Venda por atalhos · Controle de caixa · TEF, PIX e carteiras ·
  NFC-e na hora · Modo offline · Retaguarda integrada (NERP)

## `/solucoes/pdv/selfcheckout` — SelfCheckout Orbita

- **Hero:** "SelfCheckout Orbita — o cliente resolve, a fila desaparece."
- **Proposta de valor:** autoatendimento com interface simples para o shopper:
  escaneia, paga e leva. Menos fila no caixa tradicional, equipe liberada para a loja.
- **MAIS:** experiência moderna · mais caixas sem mais gente
- **MENOS:** fila de pico · abandono de compra
- **Módulos:** Scanner de código de barras · Pagamento por PIX/cartão ·
  Balança integrada · Supervisão remota (intervenções) · Visual da sua marca

## `/solucoes/pdv/orbitatotem` — OrbitaTotem

- **Hero:** "OrbitaTotem — pedido e consulta de preço sem depender do balcão."
- **Proposta de valor:** totem de autoatendimento para pedidos (food service,
  franquias) e consulta de preços (varejo), com QR de preço que abre a jornada do
  consumidor conectada ao ecossistema ORBITA.
- **Módulos:** Cardápio/pedido no totem · Consulta de preço · QR Preço (shopper
  escaneia e vê preço/promos no próprio celular) · Personalização por loja

---

## `/solucoes/bi` — BI e Analytics (página única, 2 produtos)

- **Hero:** "Dados que decidem: BI para o varejo e para a indústria."
- **Bloco 1 — NERP Dashboard (para o varejo):** indicadores em tempo real da
  operação — vendas, ticket médio, metas, ranking de vendedores, estoque crítico e
  financeiro. Dashboards compartilháveis por link com a equipe.
- **Bloco 2 — NASAEX insights (para indústria e distribuidor):** market share,
  sell in, sell out, ruptura, share de gôndola, cobertura, positivação, ROI de
  trade e comportamento do shopper (jornada de interesse via QR) — com IA
  identificando padrões ("quem pesquisa café também pesquisa leite").
- **Frase-chave:** "Não rastreamos o consumidor. Reconstruímos sua jornada de
  interesse."

---

## `/solucoes/ecommerce` — Integrações E-commerce

- **Hero:** "Venda online sem retrabalho: seu ERP conectado ao e-commerce."
- **Proposta de valor:** catálogo, estoque e pedidos sincronizados entre o ERP e o
  canal online. Duas frentes: (1) **loja online nativa** por subdomínio, inclusa no
  NERP (catálogo, carrinho, checkout); (2) **integrações** com plataformas de
  e-commerce e marketplaces via API.
- **Módulos:** Loja online nativa · Catálogo promocional digital (folheto
  PNG/PDF/link) · Sincronização de estoque e preço · Pedidos direto no ERP ·
  APIs abertas
