# Operações — `/solucoes/operacoes` (suíte ORBITA)

> Página única com âncoras por ferramenta (`#tracking`, `#chat`, ...), espelhando a
> página "Operação de Loja" da CISS mas no formato de vitrine de apps.
> Fonte: inventário real do projeto `nasaex-wey` (catálogo em
> `src/features/apps/components/apps-data.ts`). Os nomes de site usam o prefixo
> **ORBITA**; no produto os apps têm codinomes (COSMIC, SPACETIME, DEMAND...) —
> manter a nomenclatura ORBITA no site e o codinome como subtítulo se quiser charme.

---

## Hero da página

- **Título:** A suíte que faz sua operação girar em órbita
- **Subtítulo:** Ferramentas integradas numa única plataforma e numa única base de
  dados: o trabalho passa do comercial para o atendimento, da entrega ao financeiro
  — sem print, sem planilha, sem redigitação.
- **Manifesto (bloco destacado — copy real do produto, reutilizar):** "Todo foguete
  sobe por estágios. Um estágio empurra o foguete, se solta, e o próximo liga
  sozinho pra continuar a subida. Se essa troca falha, a missão acaba ali. Sua
  empresa funciona igual: cada setor entrega o trabalho pro próximo. Nossa
  plataforma existe pra que nenhuma dessas trocas falhe — do primeiro contato até a
  entrega final."

## Grid de ferramentas (cards com âncora, 2 linhas de descrição + modal/expand)

| Ferramenta | Descrição para o site (baseada no que existe) |
|------------|-----------------------------------------------|
| **ORBITA Tracking** | CRM multi-funil em kanban: vários funis por empresa, etapas personalizáveis, tags, motivos de ganho/perda, importação de leads e automação de inatividade. Arraste o card, o processo anda. |
| **ORBITA Chat** | Atendimento WhatsApp multi-instância dentro do CRM: texto, áudio, mídia, templates, etiquetas — com agenda, propostas e formulários abrindo dentro da conversa. Suporta API oficial da Meta. Modo In-Chat: se o WhatsApp cair ou for banido, o atendimento continua numa página própria, automaticamente. |
| **ORBITA Forms** | Formulários sem código cujas respostas viram lead classificado direto no funil. Construtor visual, página pública, exportação em PDF e validação de WhatsApp. |
| **ORBITA Agendas** | Múltiplas agendas com disponibilidade por responsável, página pública de agendamento e chat de agendamento. Todo horário marcado vira contato no CRM. |
| **ORBITA Workspaces** | Gestão de trabalho por quadros: tarefas com subtarefas, responsáveis, chat por tarefa, lembretes, calendário e automações com gatilhos. O setor inteiro num quadro. |
| **ORBITA Planner** | Planejamento de marketing com IA: identidade de marca, campanhas, briefing gerado por IA, mapas mentais, calendário editorial, editor de imagem/vídeo e publicação nas redes. |
| **ORBITA Forge** | Propostas e contratos: catálogo de produtos, templates, aceite público com assinatura digital e dashboard de fechamento. Proposta assinada → o atendimento recebe tudo, com histórico. |
| **ORBITA Payment** | Financeiro completo: contas a pagar/receber, fluxo de caixa, centros de custo, fluxo de aprovações, régua de cobrança automática e gateways (Asaas, Stripe, Mercado Pago). Gera cobrança e dá baixa sozinho. |
| **ORBITA Linnker** | Página de links (bio) com QR Code que captura lead direto no funil e estatísticas de acesso e escaneio. Seu link da bio virou canal de aquisição. |
| **ORBITA Pages** | Builder de landing pages com 26 blocos, templates, versionamento, analytics e domínio próprio — dá até pra comprar o domínio sem sair da plataforma. |
| **ORBITA N-box** | Arquivos da empresa organizados: pastas, links, itens públicos ou privados e cota por plano. O contrato, a arte e a planilha no mesmo lugar do processo. |
| **ORBITA Route** | Área de membros e marketplace de conteúdo: cursos, eBooks, eventos, mentorias e assinaturas — com vídeo, certificado, progresso e checkout próprio. Monetize o que sua empresa sabe. |
| **ORBITA Comments** | Automação de comentários do Instagram: palavra-chave vira lead na etapa certa do funil. Inclui gatilhos, notificações e sorteios. |
| **ORBITA Space Station** | O escritório virtual da sua empresa: um mundo 2D navegável com avatares, áudio e vídeo por proximidade, salas de reunião, auditório e eventos com ingresso. Sua operação deixou de estar escondida em sete abas. |
| **ORBITA Astro** | IA da plataforma: conhece o histórico de cada cliente, responde pelo time, prepara o atendimento e quebra objeções — com base de conhecimento própria (RAG), voz e bot de WhatsApp. Funciona com Claude, GPT e Gemini. |
| **ORBITA Disparo API Oficial WhatsApp** | Envio de mensagens pela API oficial da Meta (templates aprovados, janela de 24h, métricas de custo por conversa). ⚠️ *Ver nota 1.* |
| **ORBITA Ranking de Vendas** | Ranking de equipes e vendedores por meta: períodos diário a anual, pódio, modo telão para a loja e importação de metas via planilha (inclusive do Winthor). Quem produz aparece. |
| **ORBITA TradeGram** | Execução de trade marketing no PDV: promotores, rotas, fotos, books e planograma. ⚠️ *Ver nota 2 — é módulo do NERP, não do nasaex-wey.* |

## Seção "Automação de ponta a ponta"

Linha do tempo Chega → Avança → Fecha → Cobra → Entrega (copy real do produto):
o lead chega (Forms/Linnker/Comments), avança sozinho (Tracking + automações),
fecha (Forge), cobra (Payment) e entrega com histórico (Workspaces + Chat).
Editor visual de automações com fluxos prontos.

## Seção "Quanto custa cada passo" (opcional)

Stars (★): a moeda interna que mede o consumo de IA, integrações e automações.
"As Stars não são só como você paga — são como você enxerga quanto custa cada
passo do seu processo."

## CTA final

"Comece por um estágio. Escolha o processo que mais te dá dor de cabeça — a gente
monta ele inteiro, do começo ao fim, e você vê funcionando com um caso real antes
de mexer em qualquer outra coisa." + `CtaTriple`.

---

## ⚠️ Notas de veracidade (para João e Weydson)

1. **Disparo em massa por WhatsApp:** o que existe hoje é a infra de envio (Uazapi +
   Meta Cloud API oficial, templates HSM) e disparo em massa **por e-mail** (aviso
   In-Chat). Não há módulo de campanha de disparo em massa WhatsApp com agendamento.
   O site pode vender "Disparo via API Oficial" (verdadeiro), mas não "campanhas em
   massa" até o módulo existir.
2. **TradeGram:** não existe no `nasaex-wey` — vive no NERP (`src/features/tradegram`
   + 6 páginas públicas). No site, tratar como produto próprio (página em
   `/solucoes/erp/tradegram`) e aqui só como card com link.
3. **Números de prova social** ("2.300+ empresas", "89% de conversão", "ROI 3.8×",
   "200+ integrações") estão hard-coded na landing atual do NASAEX — **confirmar com
   o Weydson antes de publicar** no orbitatec.
4. **Integrações:** anunciar só as reais (Meta/WhatsApp, Stripe, Asaas, Mercado
   Pago, OpenAI/Anthropic/Google, Winthor via planilha, sync NERP↔NASA). O catálogo
   de 50+ logos do produto mistura integrações ainda não implementadas (Salesforce,
   HubSpot, Shopify...) — não usar no site institucional.
5. **"Offline"** não é promessa real da suíte (só retomada de upload). Não vender.

## Extras que valem menção no site (existem no produto)

- **Automações/Workflows** com editor visual e presets prontos (agendamento,
  follow-up de closer, comprovante de pagamento, proposta+contrato).
- **Space Points** — gamificação com níveis, selos e prêmios.
- **Space Help** — central de ajuda e onboarding com trilhas e badges.
- **Programa de Parceiros** — indicação com comissões e tiers.
- **Chamadas de vídeo** nativas (LiveKit) e paleta de comandos com IA.
