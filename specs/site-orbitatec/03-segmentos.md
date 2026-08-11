# Segmentos — template + conteúdo dos 9 segmentos

> Template espelhado na página de segmento da CISS:
> hero → desafios & soluções (cards) → produtos recomendados → segmentos
> complementares → CTA. Cada `ChallengeCard` tem: ícone, desafio, como resolvemos,
> e 2–3 links de produtos.

---

## Template

1. **Hero** — "Tecnologia ORBITA para [segmento]" + subtítulo com a dor nº 1 + CTA
2. **Desafios & Soluções** — 4–6 `ChallengeCard`s
3. **Combo recomendado** — barra com os produtos ideais para o segmento
4. **Outros segmentos** — links cruzados
5. **CTA final** — `CtaTriple`

---

## `/segmentos/supermercados`

- **Hero:** "O supermercado inteiro sob controle — do caixa à gôndola."
- **Desafios → Soluções:**
  | Desafio | Como resolvemos | Produtos |
  |---------|------------------|----------|
  | Fila no caixa em horário de pico | PDV ágil por atalhos + autoatendimento | OrbitaSystem, SelfCheckout Orbita |
  | Ruptura e estoque desalinhado | Inventário por loja, alertas e reposição guiada | NERP |
  | Verba de trade sem controle | Espaços da loja viram mídia negociável com contrato e ROI | TradeGram |
  | Decisão sem dado | Indicadores em tempo real e ranking de lojas | NERP Dashboard |
  | Encarte caro e lento | Catálogo promocional digital em minutos | Integrações E-commerce |
- **Combo:** NERP + OrbitaSystem + SelfCheckout + TradeGram + NERP Dashboard

## `/segmentos/farmacias`

- **Hero:** "Gestão precisa para quem não pode errar no balcão."
- **Desafios → Soluções:** controle de estoque e validade (NERP) · atendimento
  rápido no balcão (OrbitaSystem) · fidelização com cupons e cashback (NERP CRM) ·
  indicadores por loja (NERP Dashboard) · pedidos e entregas (ORBITA Route)
- **Combo:** NERP + OrbitaSystem + NERP Dashboard

## `/segmentos/distribuidoras`

- **Hero:** "Da meta à positivação: a distribuidora guiada por indicador."
- **Desafios → Soluções:**
  | Desafio | Como resolvemos | Produtos |
  |---------|------------------|----------|
  | Equipe externa sem visibilidade | Rotas de promotor, check-in por geolocalização e fotos do PDV | TradeGram |
  | Lead e cliente sem funil | CRM multi-funil com atendimento WhatsApp integrado | NASAEX (ORBITA Tracking + Chat) |
  | Meta que ninguém acompanha | Ranking de vendas e metas em tempo real, modo telão | ORBITA Ranking de Vendas, NASAEX insights |
  | Sell out invisível | Execução no PDV comprovada em foto, share de gôndola | TradeGram, NASAEX insights |
  | Processos no improviso | Metodologia NASAEX: sistematizar antes de cobrar | Gestão de Processo NASA |
- **Combo:** NASAEX + NASAEX insights + TradeGram + suíte Operações

## `/segmentos/transportadoras`

- **Hero:** "Da coleta à entrega, um processo que não se perde entre setores."
- **Desafios → Soluções:** ocorrências e comprovações com foto/assinatura
  (ORBITA Forms) · agenda de coletas e janelas de doca (ORBITA Agendas) ·
  comunicação comercial + operacional com o cliente no WhatsApp (ORBITA Chat) ·
  funil de cotações e novos embarcadores (ORBITA Tracking) · cobrança de fretes e
  fluxo de aprovações (ORBITA Payment) · processos padronizados (Gestão de
  Processo NASA)
- **Combo:** suíte Operações (Forms + Agendas + Chat + Payment) + NERP Financeiro
- ⚠️ **Nota interna:** hoje não existe módulo de roteirização/rastreamento de
  frota nos projetos. Não prometer isso no site; o ângulo do segmento é processo,
  atendimento e financeiro. Se roteirização entrar no roadmap, atualizar a página.

## `/segmentos/centros-automotivos`

- **Hero:** "Oficina organizada: da ordem de serviço ao pagamento."
- **Desafios → Soluções:** ordens de serviço e orçamentos (ORBITA Forms + Forge) ·
  agenda de boxes e mecânicos (ORBITA Agendas) · peças e estoque (NERP) ·
  cobrança na entrega (ORBITA Payment) · histórico por veículo/cliente (NERP CRM)
- **Combo:** NERP + Operações (Agendas + Forms + Payment)

## `/segmentos/atacarejos`

- **Hero:** "Volume alto, margem apertada, controle absoluto."
- **Desafios → Soluções:** preço por perfil (atacado/varejo) no PDV (OrbitaSystem) ·
  giro e ruptura em escala (NERP) · autoatendimento para reduzir custo de frente
  (SelfCheckout Orbita) · negociação com indústria baseada em dados de gôndola
  (TradeGram + NASAEX insights)
- **Combo:** NERP + OrbitaSystem + SelfCheckout + NASAEX insights

## `/segmentos/franquias`

- **Hero:** "Padrão de rede, visão de franqueadora."
- **Desafios → Soluções:** padronização da operação entre unidades (Gestão de
  Processo NASA + ORBITA Pages) · consolidação multi-CNPJ (NERP multiempresa) ·
  ranking de unidades (NERP Dashboard) · auditoria de padrão em foto (TradeGram) ·
  pedidos no balcão/totem (MeuPedido, OrbitaTotem)
- **Combo:** NERP + NERP Dashboard + TradeGram + MeuPedido

## `/segmentos/food-service`

- **Hero:** "Do pedido à cozinha em segundos — sem papel, sem erro."
- **Desafios → Soluções:** comanda digital (MeuPedido) · painel de cozinha (KDS)
  (MeuPedido) · autoatendimento no salão (OrbitaTotem) · caixa integrado
  (OrbitaSystem) · ficha técnica e estoque (NERP) · promoções pelo WhatsApp via
  API oficial (ORBITA Chat + Disparo — ver nota 1 de `05-operacoes.md`)
- **Combo:** MeuPedido + OrbitaTotem + OrbitaSystem + NERP

## `/segmentos/clinicas-e-consultorios`

- **Hero:** "Agenda cheia, recepção leve, cobrança em dia."
- **Desafios → Soluções:** agendamento com página pública e confirmação pelo
  WhatsApp (ORBITA Agendas + Chat) · fichas e anamneses digitais (ORBITA Forms) ·
  cobrança e régua de cobrança automática (ORBITA Payment) · jornada do paciente em
  kanban + documentos organizados (ORBITA Tracking + N-box) · gestão financeira
  (NERP Financeiro)
- **Combo:** suíte Operações (Agendas + Forms + Payment) + NERP
