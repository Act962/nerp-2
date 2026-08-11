# Site ORBITATEC — Visão Geral

> Esqueleto do site institucional **www.orbitatec.com.br** — porta de entrada da empresa.
> Estrutura inspirada em ciss.com.br (mesma arquitetura de seções, cards, CTAs e rodapé),
> com nomenclaturas, produtos e conteúdo da ORBITA.
> Responsável pelo desenvolvimento: João.
> Criado em: 2026-08-11

---

## 1. Objetivo

Site institucional que apresenta **todas as tecnologias** dos projetos `nerp-wey`,
`nerp-wey2` (Orbita ERP / NERP) e `nasaex-wey` (suíte de operações). Não é o app —
é vitrine, geração de leads e credibilidade. Sem blog no lançamento (estrutura
preparada para adicionar depois).

**Conversão principal:** "Agendar Demonstração" (formulário) + WhatsApp.

---

## 2. Identidade visual

Tema: **espaço/órbita**. Como na CISS, o fundo predominante é escuro — aqui, preto
absoluto com azul como cor de destaque.

### Paleta

| Token | Cor | Uso |
|-------|-----|-----|
| `--background` | `#05070D` (preto espacial, quase absoluto) | Fundo predominante de todas as seções |
| `--surface` | `#0B1220` (azul-marinho profundo) | Cards, seções alternadas |
| `--primary` | `#1E9BF0` (azul ORBITA — mesmo azul da logo) | Botões, links, ícones, destaques |
| `--primary-hover` | `#3FB0FF` | Hover de botões/links |
| `--accent-red` | `#F31511` (vermelho do "A" da logo NASAEX) | Usar SÓ em contexto NASAEX (badge, detalhe) |
| `--foreground` | `#FFFFFF` | Títulos |
| `--muted` | `#9FB3C8` (azul-acinzentado claro) | Textos de apoio, parágrafos |
| `--border` | `#1B2A41` | Bordas de cards, divisores |

### Tipografia

- Títulos: sans-serif geométrica com tracking amplo (a logo ORBITA usa letras
  espaçadas) — sugestão: **Montserrat** ou **Space Grotesk**, peso 600/700, branca.
- Corpo: **Inter**, peso 400/500, cor `--muted`.
- Destaques dentro de títulos em `--primary` (ex.: "Conectando o varejo ao **futuro**").

### Elementos visuais recorrentes

- Campo de estrelas sutil / gradiente radial azul no hero (remete a espaço).
- Anel/órbita da logo como elemento decorativo de fundo (traço circular incompleto).
- Cards com fundo `--surface`, borda `--border`, hover com glow azul.
- Ícones lucide (linha fina) em azul.
- Logos: ORBITA (anel azul + wordmark) e NASAEX (N.A.S.A. com "A" vermelho) — anexadas
  pelo Weydson; versões para fundo escuro já existem.

---

## 3. Stack sugerida

Next.js 15 (App Router) + Tailwind 4 + shadcn/ui + lucide — mesma stack dos outros
projetos, para o João reaproveitar componentes. Site 100% estático/SSG (sem banco),
formulários via API route enviando para e-mail/WhatsApp. Deploy Vercel com o domínio
orbitatec.com.br.

---

## 4. Sitemap

```
/                               Home
/solucoes                       Portfólio (visão geral de todas as soluções)
  /solucoes/erp/nerp            NERP (Orbita ERP)
  /solucoes/erp/orbitalive      OrbitaLive
  /solucoes/erp/meupedido       MeuPedido
  /solucoes/erp/nasaex          NASAEX
  /solucoes/erp/tradegram       TradeGram
  /solucoes/pdv/orbitasystem    OrbitaSystem
  /solucoes/pdv/selfcheckout    SelfCheckout Orbita
  /solucoes/pdv/orbitatotem     OrbitaTotem
  /solucoes/bi                  BI e Analytics (NASAEX insights + NERP Dashboard)
  /solucoes/operacoes           Operações (suíte ORBITA — 18 ferramentas, página única com âncoras)
  /solucoes/ecommerce           E-Commerce (integrações)
/servicos                       Serviços (Implantação, DataORBITA, Consultoria, Gestão de Processo, Desenvolvimento)
/segmentos/supermercados
/segmentos/farmacias
/segmentos/distribuidoras
/segmentos/transportadoras
/segmentos/centros-automotivos
/segmentos/atacarejos
/segmentos/franquias
/segmentos/food-service
/segmentos/clinicas-e-consultorios
/sobre                          Institucional (quem somos + metodologia NASAEX)
/contato                        Fale conosco / Agendar demonstração
/politica-de-privacidade
```

Total: ~25 páginas, mas **4 templates** resolvem tudo:

| Template | Usado em | Spec |
|----------|----------|------|
| Home | `/` | `01-home.md` |
| Página de produto | ERPs, PDVs, BI, E-commerce | `02-solucoes.md` |
| Página de segmento | 9 segmentos | `03-segmentos.md` |
| Institucional/apoio | Sobre, Serviços, Contato, Privacidade | `04-institucional.md` |
| Suíte de Operações | `/solucoes/operacoes` (18 ferramentas) | `05-operacoes.md` |

---

## 5. Navegação (header)

Header fixo, fundo `--background` com blur, logo ORBITA à esquerda.

| Item | Tipo | Conteúdo |
|------|------|----------|
| **Segmentos** | dropdown | 9 segmentos |
| **Soluções** | mega-menu | Colunas: ERPs (5), PDVs (3), BI e Analytics, Operações, E-Commerce, Portfólio completo |
| **Serviços** | dropdown | Implantação NASAEX, DataORBITA, Consultoria IC NASAEX, Gestão de Processo NASA, Desenvolvimento de Sistemas |
| **Sobre** | link | `/sobre` |
| **Suporte** | dropdown | WhatsApp, e-mail, horários |
| CTA (botão azul) | botão | **Agendar Demonstração** → `/contato` |

Mobile: menu hamburger com acordeões por categoria.

---

## 6. Rodapé (padrão CISS, em todas as páginas)

6 colunas de links sobre fundo `--surface`:

- **Soluções**: NERP, OrbitaLive, MeuPedido, NASAEX, TradeGram, OrbitaSystem, SelfCheckout Orbita, OrbitaTotem, NASAEX insights, NERP Dashboard, +ver todas
- **Operações**: ORBITA Workspaces, Tracking, Planner, Forms, Chat, Payment, +ver todas (→ `/solucoes/operacoes`)
- **Serviços**: Implantação NASAEX, DataORBITA, Consultoria Inteligência Comercial, Gestão de Processo NASA, Desenvolvimento de Sistemas
- **Segmentos**: os 9 segmentos
- **Institucional**: Sobre a ORBITA, Metodologia NASAEX, Fale Conosco, Política de Privacidade
- **Suporte**: WhatsApp, e-mail de suporte, horário de atendimento

Barra final: © 2026 ORBITA Tecnologia · redes sociais (Instagram, LinkedIn, YouTube) ·
logo NASAEX pequena ao lado da ORBITA.

---

## 7. Componentes globais reutilizáveis

| Componente | Descrição | Onde aparece |
|------------|-----------|--------------|
| `HeroSection` | Título grande + subtítulo + 2 CTAs + arte espacial de fundo | Todas as páginas |
| `SegmentCards` | Grid de cards clicáveis com ícone (9 segmentos) | Home, páginas de segmento |
| `SolutionCard` | Card de produto: logo/nome, 1 linha, link "Conhecer" | Home, portfólio, segmentos |
| `ChallengeCard` | Desafio → solução + links de produtos relacionados | Páginas de segmento |
| `ModuleGrid` | Grid de cards de módulos/funcionalidades com ícone | Páginas de produto |
| `StatsBar` | Números de validação ("+X clientes", "+X CNPJs"...) | Home, produto |
| `MethodologySection` | Os 4 passos NASAEX (Necessidade → Análise → Sistematização → Ação) | Home, Sobre, Serviços |
| `CtaTriple` | 3 caminhos de contato: WhatsApp, telefone, "Nós ligamos para você" (form) | Fim de todas as páginas |
| `LeadForm` | Nome, e-mail, telefone/WhatsApp, segmento (select), mensagem | Contato + CtaTriple |

---

## 8. Critérios de aceite (gerais)

- [ ] Todas as rotas do sitemap renderizando com conteúdo desta spec
- [ ] Fundo preto predominante, azul como destaque, tipografia branca/azul (tema espaço)
- [ ] Header com mega-menu de Soluções e CTA "Agendar Demonstração" sempre visível
- [ ] Rodapé completo idêntico em todas as páginas
- [ ] Formulário de lead funcional (envio por e-mail ou webhook WhatsApp)
- [ ] Responsivo (mobile-first) e Lighthouse ≥ 90 em Performance/SEO/A11y
- [ ] Metatags OG + favicon com o anel da ORBITA
- [ ] Sem blog (mas rodapé/nav preparados para receber depois)
