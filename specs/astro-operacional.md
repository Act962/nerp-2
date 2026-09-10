# Astro operacional — o épico inteiro, em uma página

> O nerp sem barreira de entrada e o Astro como a inteligência de operação de cada organização. Seis fases, seis branches, seis specs. Este arquivo é o mapa: o que cada fase entregou, o que segura o isolamento entre empresas e o que a conta paga.
> Specs das fases: `sandbox-fase-0-brechas`, `sandbox-fase-1-entrada`, `astro-fase-2-leitura`, `astro-fase-3-acoes`, `astro-fase-4-imagens-web`, `astro-fase-5-avisos-memoria`, `astro-fase-6-suporte`.
> Criado em: 2026-09-11 · Status: 🟡 Em revisão pelo dev

---

## O que mudou, em uma frase

Qualquer pessoa entra em `nerp.nasaex.com`, clica em "Começar agora" e passa a usar o sistema inteiro dentro do limite de ★ do plano de cortesia — sem cadastro. E o Astro, que no site era consultor, dentro do nerp lê a operação, age nela com aprovação, enxerga imagens, consulta a web, avisa sozinho, lembra do que combinaram e abre chamado com o suporte.

---

## As seis fases

| Fase | Branch | O que entregou |
|---|---|---|
| 0 | `feat/sandbox-fase-0-brechas` | Fechou o que a entrada anônima amplificaria: rate limit no banco, limite de organizações por conta, subdomínio com papel e nomes reservados, objetos do R2 com dono e cota, escopos S2S fail-closed |
| 1 | `feat/sandbox-fase-1-entrada` | "Começar agora" com conta anônima, onboarding estático de nicho e soluções, empresa de teste já com dados, sandbox que não sai para o mundo, vínculo com Google e expiração em 30 dias |
| 2 | `feat/astro-fase-2-leitura` | Vinte e uma ferramentas de leitura: vendas com comparação e previsão, clientes inativos, estoque, calendário, trade, catálogos, WhatsApp, Stars e suporte |
| 3 | `feat/astro-fase-3-acoes` | Escrita com cartão de aprovação assinado: catálogo promocional, campanha de WhatsApp em dois passos, ação no calendário e imagem em produto, tudo com rastro em `AstroAcao` |
| 4 | `feat/astro-fase-4-imagens-web` | Anexo de imagem com dono conferido pelo prefixo do bucket, geração de imagem com cota, busca na web cobrada por passo com fontes |
| 5 | `feat/astro-fase-5-avisos-memoria` | Seis avisos avaliados por cron sem IA, falados pelo mascote e reunidos numa central; memória por organização com aprovação |
| 6 | `feat/astro-fase-6-suporte` | Chamado com o suporte carregando o contexto da empresa, teto de conversa por dia por organização e log estruturado por ferramenta |

Cada branch parte de `origin/main` e carrega as anteriores empilhadas. Nenhuma vai para a `main` sem o dev pedir.

---

## O que segura o isolamento entre organizações

Não é uma regra do prompt, e é de propósito: prompt se contorna com uma mensagem bem escrita.

1. **`organizationId` mora na closure, nunca no `inputSchema`.** Não existe argumento que faça uma tool consultar outra empresa, porque o argumento não existe. É o que o teste de isolamento verifica ferramenta por ferramenta.
2. **Todo id que chega por argumento é revalidado** com `findFirst({ id, organizationId })` antes de virar resposta ou escrita.
3. **`SaleItem` não tem `organizationId`** — toda agregação por item passa pela venda.
4. **O anexo vale pelo endereço**: só o que está sob `https://<bucket>/<orgId>/` entra numa conversa. Uma mensagem forjada não faz o servidor ler arquivo alheio.
5. **A memória e os avisos são sempre por organização**, e o canal do site não tem memória nenhuma — há teste que passa uma de propósito e confere que ela não entra no prompt.
6. **A sandbox não sai para o mundo.** Vitrine, convite, WhatsApp real, ERP, integrações, importação e compra exigem conta verificada.

---

## O que paga a conta

- **★ por bloco de mil tokens** em toda resposta, debitado no fim, com pré-checagem de saldo antes de começar.
- **★ por ação**: catálogo e campanha 5, imagem gerada 5, busca na web 1 por passo com fontes. Ação cobrada **depois** do sucesso — e nunca desfazendo o que a pessoa aprovou.
- **Cotas**: 20 imagens geradas por dia por organização, 4 anexos por mensagem, cota diária de bytes no bucket.
- **Tetos**: mensagens por sessão, mensagens por dia no site inteiro e mensagens por dia por organização (Fase 6, desligado por padrão).
- **Janela de contexto**: dezesseis mensagens, com as duas primeiras preservadas. Sem corte, o custo de uma conversa cresceria ao quadrado.
- **O prompt tem teto testado** (12.500 caracteres no canal logado, perto de 11.000 no site). O catálogo completo das ferramentas sai por tool, sob demanda: ele passa de 30 mil caracteres e seria pago em toda mensagem de toda conversa.

---

## Onde a IA NÃO é usada, de propósito

- **Todo o onboarding.** Clique, conta anônima, dados de exemplo, guia por solução, banner de expiração: código determinístico, zero tokens.
- **Os avisos proativos.** Seis consultas ao banco num cron, três vezes por dia. Um modelo lendo a operação de cada organização multiplicaria a fatura pelo número de clientes e ainda contaria pior.
- **A previsão de vendas.** Estatística declarada — média de 28 dias com fator por dia da semana e faixa de um desvio —, com o método e a confiança na resposta. Número de futuro sem método é chute com cara de certeza.
- **O resumo de conversa longa** é o único uso fora da conversa, e nasce desligado.

---

## O que o dev precisa fazer

- `pnpm db:deploy` — seis migrations acumuladas; `SCHEMA_VERSION` já está em `v93-fase6-astro-suporte`.
- Rodar `pnpm test:integration` numa máquina com Docker: a suíte foi escrita e checada por tipo, mas não roda onde não há banco de teste.
- Ajustar `LIMITES_A_PARTIR_DE` para a data real do deploy.
- Conferir `GOOGLE_GENERATIVE_AI_API_KEY` no ambiente: sem provedor Google não há busca na web nem geração de imagem.
- Testar o retorno do Google em staging com uma sessão anônima — é o risco número um da Fase 1.
- Fornecer as fotos dos pacotes de exemplo dos nichos que faltam.
- Plugar o `@better-auth/stripe` para assinaturas: os planos estão hard-coded no formato que ele espera, com nome e preço em branco de propósito.

---

## O que ficou de fora, e por quê

- **Aviso por e-mail ou WhatsApp.** Tudo é dentro do sistema; quem não abrir não fica sabendo.
- **Limpeza de objetos órfãos no R2.** O prefixo por organização da Fase 0 torna isso possível; ninguém varre ainda.
- **Suíte própria do `@nerp/astro-widget`.** O pacote não tem vitest configurado, então cartão de aprovação, anexo, selo e balão não têm teste de componente.
- **Tela para a configuração do Astro.** Modelo, tetos e resumo de conversa vivem na chave `astro-config` em `SiteSetting`.
