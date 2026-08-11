# Institucional — Sobre, Serviços, Contato, Privacidade

---

## `/sobre` — Sobre a ORBITA

1. **Hero:** "Tecnologia com método: prazer, somos a ORBITA."
2. **Nossa história** — parágrafos (Weydson valida/completa):
   nascemos dentro da operação real do varejo e da distribuição. Antes de escrever
   código, escrevemos processo — e foi assim que nasceu a metodologia NASAEX, hoje
   aplicada em todos os nossos produtos e projetos.
3. **Metodologia NASAEX** (`MethodologySection`, versão estendida — a mesma da home,
   com um parágrafo por passo):
   - **N — Necessidade:** todo projeto começa ouvindo quem opera. Mapeamos a dor
     real, não o pedido de ferramenta.
   - **A — Análise:** dados, processos e números na mesa. Entendemos causa, não
     sintoma.
   - **S — Sistematização:** a solução vira sistema, rotina e indicador — para não
     depender de memória nem de heroísmo.
   - **A — Ação:** implantação, treinamento e acompanhamento na ponta, medindo
     resultado.
4. **Nossos pilares** — 4 cards (Indústria, Distribuidor, Varejo, Consumidor):
   conectamos os quatro elos numa única base de inteligência. A indústria vê onde
   seu produto está; o distribuidor mede execução; o varejo monetiza seus espaços;
   o consumidor compra melhor.
5. **Números** — `StatsBar` (mesmos da home).
6. **CTA final.**

---

## `/servicos` — Serviços (página única com âncoras)

**Hero:** "Não entregamos só software. Entregamos operação funcionando."

Cards grandes, um por serviço:

### Implantação NASAEX
Implantação do ERP NASAEX de ponta a ponta: diagnóstico da operação, parametrização,
migração de dados, treinamento por função e go-live acompanhado. Só damos a
implantação por encerrada quando o indicador roda na tela — não quando o sistema é
instalado.

### DataORBITA
Serviço de dados: saneamento de cadastros (produtos, clientes, fornecedores),
importação e migração de bases legadas, integrações entre sistemas e rotinas de
qualidade de dados. Seu ERP é tão bom quanto o dado que entra nele.

### Consultoria Inteligência Comercial NASAEX
Consultoria para distribuidoras e indústrias: estruturação de metas, cobertura,
positivação, ranking de vendas e rituais de gestão comercial — com os dashboards
NASAEX insights como instrumento. Metodologia NASAEX aplicada ao comercial.

### Gestão de Processo NASA
Mapeamento e sistematização de processos da empresa (comercial, logística,
financeiro, loja): desenhamos o processo, definimos indicadores e implantamos as
ferramentas ORBITA que o sustentam. Processo primeiro, sistema depois.

### Desenvolvimento de Sistemas
Desenvolvimento sob medida: módulos específicos, integrações com ERPs legados
(WinThor, TOTVS, Oracle, SAP), APIs e automações. A mesma engenharia que constrói
os produtos ORBITA, a serviço do seu problema.

**CTA final** + cross-link para `/solucoes`.

---

## `/contato` — Fale conosco / Agendar demonstração

1. **Hero curto:** "Vamos conversar sobre a sua operação?"
2. **`LeadForm` completo:** nome · empresa · e-mail · telefone/WhatsApp ·
   segmento (select com os 9) · interesse (select: ERP, PDV, BI, Operações,
   Serviços, Outro) · mensagem
3. **Canais diretos:** WhatsApp (botão) · e-mail comercial · horário de atendimento
4. Confirmação pós-envio: "Recebemos! Um especialista fala com você em até 1 dia útil."

> Implementação: API route → e-mail (Resend/SMTP) e/ou notificação no WhatsApp.
> Guardar leads também numa planilha/DB simples para não perder histórico.

---

## `/politica-de-privacidade`

Página texto padrão LGPD: dados coletados no formulário (nome, contato, empresa),
finalidade (contato comercial), base legal (consentimento), retenção, direitos do
titular, canal do DPO/contato. **Gerar rascunho e validar com o Weydson antes de
publicar.**
