# Mapeamento do banco do ERP — página interna (Ports & Adapters)

> Página interna para explorar o banco do ERP do cliente (tabelas, colunas, amostra) e mapear de onde vem cada tipo de dado do NERP, sem SQL chumbado por cliente.
> Feature: `src/features/mapeamento-banco` + `src/app/router/mapeamento-banco` + `src/app/(main)/(rest)/integracoes/banco-de-dados`
> Criado em: 2026-10-22 · Atualizado em: 2026-10-22 (diagrama, cliente, MCP, perfil de coluna, importação; MVP fechado)
> Status: ✅ MVP pronto para revisão (uso interno) — falta o dev revisar/commitar e validar no Armazém depois do deploy

---

## Situacao atual

O NERP lê o banco do cliente com SQL fixo do "Winthor padrão"
(`src/features/erp-sync/server/connectors/winthor-products.ts`: `PCPRODUT`,
`PCEST`, `PCPEDI`). Cada empresa tem tabelas e permissões próprias: no Armazém
Carvalho a credencial enxerga 159 tabelas (schemas LGCARVALHO e SWMS, muitas
próprias — `TBCMS*`, `TBSWMS*`) e **não** enxerga `PCTABPR`, `PCREGIAO`,
`PCEMBALAGEM` nem `PCPRECOPROM`. O preço lá é por região (`PCPEDC.NUMREGIAO`) e
só aparece no histórico de vendas.

Esta entrega cria a página onde a equipe explora o banco e salva o mapeamento.
Os syncs **não** mudam aqui — consumir o mapeamento é a próxima entrega.

Arquivos principais:
- `src/features/mapeamento-banco/domain/*` — estrutura, contrato do NERP, mapeamento, conversão (puro)
- `src/features/mapeamento-banco/ports/*` — portas do banco, do repositório e do vocabulário
- `src/features/mapeamento-banco/application/*` — casos de uso, só conhecem as portas
- `src/features/mapeamento-banco/adapters/{oracle,winthor,prisma}/*` — adaptadores
- `src/features/mapeamento-banco/server/compor.ts` — o único lugar que escolhe adaptador por motor
- `src/app/router/mapeamento-banco/*` — procedures
- `prisma/schema.prisma` — `ErpConnection.dataMapping Json?`; `Customer.erpCode` + `Customer.erpBlocked`
- `src/features/mapeamento-banco/domain/importacao.ts` + `application/importar.ts` + `adapters/prisma/destino-no-nerp.ts` — importação ERP → NERP

---

## Pendencias

### Funcional

- [x] **Domínio puro** (`domain/`) — estrutura, alvos (Produto, Estoque, Categoria, Preço, Promoção), schema zod versionado do mapeamento, `validarMapeamento`, `converterLinha`.
- [x] **Portas e casos de uso** (`ports/`, `application/`) — explorar, descrever, amostrar, testar, salvar, sugerir.
- [x] **Adaptador Oracle** (`adapters/oracle/`) — introspecção sob demanda (`all_tables`, `all_views`, comentários, colunas, PK/FK, índices), sempre qualificada por owner; amostra com `FETCH FIRST`; leitura mapeada com até 1 junção, filtros, janela e "último por chave".
- [x] **Vocabulário e perfis do Winthor** (`adapters/winthor/`) — rótulos do `glossary.ts` e perfis automáticos por tipo.
- [x] **Repositório** (`adapters/prisma/`) — lê/grava `ErpConnection.dataMapping`.
- [x] **Migration** — `ErpConnection.dataMapping JSONB` + bump do `SCHEMA_VERSION`.
- [x] **Acesso** (`src/app/middlewares/mapeamento-banco.ts`) — admin da org **e** super admin.
- [x] **Procedures** (`src/app/router/mapeamento-banco/`) — conexao, tabelas, descrever, amostra, atualizarEstrutura, mapeamento.{ler,salvar,testar,sugerir}.

- [x] **Tipo Cliente** — campos (código, razão social, fantasia, CPF/CNPJ, telefone, e-mail, cidade, UF, ativo) + perfil Winthor `PCCLIENT`.
- [x] **MCP do NERP** (`src/features/mcp/` + `src/app/api/mcp/route.ts`) — servidor MCP por HTTP (Streamable HTTP, sem sessão, `@modelcontextprotocol/sdk`) para um agente de IA mapear o banco conversando. Habilidade "mapeamento": `conexao_do_banco`, `tipos_do_nerp`, `listar_tabelas`, `descrever_tabela`, `amostrar_tabela`, `ligacoes_entre_tabelas`, `estado_do_mapeamento`, `sugerir_mapeamento`, `validar_mapeamento`, `testar_mapeamento`, `salvar_mapeamento` + prompt `mapear_banco`. Chama os MESMOS casos de uso da tela.
- [x] **Conversões genéricas** — além das de booleano, texto aceita `gtinValido` (só código de barras com dígito verificador certo; barra o código interno repetido no campo do EAN) e `somenteDigitos` (tira máscara de CPF/CNPJ/telefone). Permitidas por tipo de campo (`CONVERSOES_POR_TIPO`).
- [x] **Campos novos** — Estoque: `reservada`, `bloqueada` (disponível = quantidade − reservada − bloqueada); Cliente: `celular`, `bloqueado` (crédito, ≠ inativo), `vendedor`. Perfis do Winthor preenchidos (QTRESERV, QTBLOQUEADA, TELCELENT, BLOQUEIO, CODUSUR1) com as conversões.
- [x] **Perfil de coluna** (`application/perfilar-coluna.ts`, porta `perfilarColuna`) — % preenchido, distintos, mín/máx, tamanho, mais comuns e FORMATOS (dígito→9, letra→A/a). Tabela > 300 mil linhas lida por `SAMPLE BLOCK` (~300 mil linhas); coluna com quase todo valor único não lista valores, só formatos. Na tela: clique no nome da coluna (aba Estrutura). No MCP: `perfilar_coluna`.
- [x] **Busca de coluna** (`buscarColunas`) — nome ou comentário em todas as tabelas visíveis. No MCP: `buscar_colunas`.
- [x] **Token do agente** (`src/app/router/mcp/tokens.ts`) — gerar (aparece uma vez), listar e revogar; botão "Agente de IA" no cabeçalho do mapeamento com a configuração pronta para Claude Code, Claude Desktop (via `mcp-remote`) e Cursor.
- [x] **Importação ERP → NERP** — produto, cliente e estoque, lidos pelo mapeamento SALVO. Regras puras em `domain/importacao.ts`; porta `DestinoNoNerpPort` + adaptador Prisma; casos de uso `simularImportacao` (lê tudo, não grava) e `importarLote` (uma página por chamada, cursor pela chave do tipo — paginação keyset no `sqlLeituraMapeada`; estoque numa chamada só).
  - Produto: casa pelo `erpCode`, depois pelo código de barras (conflito se a barra já é de outro código do ERP). O ERP só PREENCHE o vazio (`barcode`, `packQty`); `erpActive` sempre espelha; nome, preço e categoria do NERP nunca mudam. Criar faltantes é opcional (padrão: não), e inativo no ERP nunca é criado.
  - Cliente: casa pelo `erpCode`, depois pelo CPF/CNPJ com dígito verificador válido (o "111.111.111-11" do consumidor final não casa). Mesmo CNPJ em vários códigos: o primeiro vincula, os outros viram cadastro próprio. Preenche só documento, e-mail (se livre na org), telefone/celular, cidade e UF vazios; `erpBlocked` espelha. Criar faltantes: padrão sim.
  - Estoque: retrato por filial com o DISPONÍVEL (quantidade − reservada − bloqueada), só de produto vinculado; troca o espelho (`ProductBranchStock`) numa transação e põe o disponível da filial configurada em `currentStock`, como o sync do ERP.
- [x] **Migration `Customer.erpCode`/`erpBlocked`** — vínculo do cliente com o ERP (como `Product.erpCode`) + índice `(organizationId, erpCode)`; `SCHEMA_VERSION` v111.
- [x] **Escopo `mcp:importacao`** — ferramentas `simular_importacao` (só leitura) e `importar` (exige `confirmado: true`; produto e cliente em lotes de até 3.000 com `proximo`) + prompt `importar_dados`. Separado de `mcp:mapeamento` porque grava: o token mapeia sempre e importa só se ligado (ao gerar, ou no interruptor "Importar" da lista de tokens).

### UX

- [x] **Página estilo Supabase Studio** — topo com conexão; aside com tabelas por schema (busca, filtros); abas Estrutura / Dados / Relações; modo Mapear com os 5 tipos.
- [x] **Responsiva** — aside vira gaveta no celular; grade rola dentro do container.
- [x] **Entrada** — botão "Mapear banco de dados" no painel do Winthor, só para a equipe do mapeamento.
- [x] **Diagrama** (`components/diagrama/`) — modo "Diagrama" no molde do Schema Visualizer do Supabase: um cartão por tabela (chaves, colunas ligadas, "+N colunas"), traço tracejado para chave declarada e pontilhado para a inferida pelo nome, seletor de schema, "Ir para tabela", auto layout (dagre), minimapa e legenda.

---

## Criterios de aceite

- **CA-1** — `/integracoes/banco-de-dados` abre para a equipe do mapeamento (super admin + `dev@nasaerp.com`) quando é admin da org; outro usuário, mesmo dono da org, recebe 404, e as procedures dão FORBIDDEN.
- **CA-2** — A lista mostra LGCARVALHO e SWMS com as 159 tabelas, linhas e rótulos ("PCPRODUT · Produtos"); a busca filtra.
- **CA-3** — Estrutura da `PCPEDI` mostra colunas, tipos, PK e índices; Dados da `PCPRODUT` traz 50 linhas em menos de 5 s; na `PCPEDI` (17 mi) filtrar por coluna sem índice líder é recusado com explicação.
- **CA-4** — "Sugerir" no Armazém: Produto `PCPRODUT`, Estoque `PCEST`, Categoria `PCDEPTO`/`PCSECAO`, Preço "pelas vendas" com o motivo "PCTABPR sem permissão", Promoção indisponível.
- **CA-5** — "Testar" no Preço mostra o Purelac 1kg (108238) a 21,45 com "código existe no NERP".
- **CA-6** — Mapear o Estoque manualmente para outra tabela, salvar e recarregar mantém o mapeamento; campo obrigatório faltando bloqueia o salvar com a mensagem certa.
- **CA-7** — No celular (375 px), lista em gaveta, abas e grade utilizáveis, sem rolagem horizontal da página.
- **CA-8** — Nenhum arquivo dos syncs de produto, estoque e preço muda.
- **CA-10** — `/api/mcp` sem token responde 401; com token: `initialize`, 13 ferramentas e o prompt `mapear_banco`; `estado_do_mapeamento` dá Cliente pronto pelo `PCCLIENT`; `amostrar_tabela` com filtro sem índice na `PCPEDI` volta como erro da ferramenta; token revogado volta a dar 401.
- **CA-11** — `perfilar_coluna` em PCPRODUT.CODAUXILIAR mostra os formatos `9999999999999` (EAN-13) e `99999`/`999999` (código interno); em PCPEDI (17 mi) usa amostra de blocos; Purelac sai com EAN válido e o 299685 sem EAN; estoque da filial 2 traz reservada/bloqueada; cliente sai com documento só em dígitos.
- **CA-12** — Com um token sem importação, `simular_importacao`/`importar` não aparecem; ligado o "Importar", aparecem, e `importar` sem `confirmado: true` é recusado.
- **CA-13** — `simular_importacao` lê o tipo inteiro sem gravar (Armazém: 24.096 produtos, 90.699 estoques, 27.886 clientes; o documento do cliente sai mascarado nos exemplos).
- **CA-14** — `importar` produto em lotes até `proximo` = null vincula pelo código de barras e grava `erpCode`/`packQty`/`erpActive`; rodar de novo dá tudo "sem mudança". `importar` estoque troca o espelho numa chamada e atualiza o estoque dos produtos vinculados.
- **CA-9** — Diagrama do LGCARVALHO mostra as 16 tabelas ligadas (34 ligações inferidas, nenhuma declarada); o do SWMS, 113 tabelas e 205 ligações (5 declaradas) num bloco deitado, não numa coluna; "Ir para tabela" centraliza e destaca a tabela e as ligações dela.

### Verificação (2026-10-22, NERP de dev na org Gotham → Oracle do Armazém, só leitura)

| CA | Resultado |
|---|---|
| CA-1 | ✅ fora da equipe: página 404 e procedure 403 "restrito à equipe interna", mesmo sendo dono da org |
| CA-2 | ✅ 159 tabelas (LGCARVALHO + SWMS), 111 views do APEX filtradas |
| CA-3 | ✅ Dados da PCPRODUT: 50 linhas em ~650 ms; filtro sem índice na PCPEDI recusado com o motivo |
| CA-4 | ✅ Produto PCPRODUT, Estoque PCEST, Categoria PCSECAO + PCDEPTO, Cliente PCCLIENT, Preço "último preço vendido" (PCTABPR: sem permissão), Promoção indisponível |
| CA-5 | 🟡 108238 a R$ 21,454 nas regiões 9, 11 e 2; "existe no NERP" só confere no Armazém de produção (na Gotham o produto não existe) |
| CA-6 | ✅ Estoque manual salvo continua manual depois de recarregar; sem "Quantidade" o salvar é recusado e nada muda |
| CA-7 | ✅ 375 px: gaveta "Abrir tabelas" abre e fecha ao escolher; abas e grade de 50 linhas usáveis; a grade rola dentro dela, a página não rola para o lado |
| CA-8 | ✅ nenhum arquivo dos syncs mudou |
| CA-9 | ✅ conferido no Chrome |
| CA-10, CA-11 | ✅ pelo MCP, contra o Oracle |
| CA-12 | ✅ sem o escopo as ferramentas não aparecem; com ele, 15 ferramentas; `importar` sem `confirmado` recusado |
| CA-13 | ✅ 24.096 produtos, 90.699 estoques e 27.886 clientes simulados sem gravar |
| CA-14 | ✅ 9 lotes, 2 produtos vinculados; segunda passada "sem mudança"; estoque trocado numa chamada |

---

## Decisoes tomadas

- **Um problema por vez** — primeiro a página e a arquitetura; sync de preço e ofertas no catálogo vêm depois, consumindo o mapeamento salvo.
- **Ports & Adapters** — o NERP conversa com `BancoDeDadosPort`; Oracle é o primeiro adaptador. Outro motor = outro adaptador + uma linha em `compor.ts`. Nome de ERP (Winthor) só aparece em `adapters/winthor/`.
- **Uso interno primeiro** — o acesso é admin da org **e** `isSuperAdmin`, num middleware só (`src/app/middlewares/mapeamento-banco.ts`). Abrir para o cliente = tirar o `isSuperAdmin` dali. A página trabalha no banco da org atual; a equipe entra na org do cliente.
- **Sem tabela nova** — o mapeamento é um JSON versionado em `ErpConnection.dataMapping`, validado com zod ao ler e ao gravar. Uma conexão de ERP por org, um mapeamento por conexão.
- **Estrutura sob demanda** — a lista de tabelas é uma consulta leve; colunas, chaves e índices vêm por tabela, quando abertas. O `dictionary.ts` do dashboard carrega tudo de uma vez e só acha tabela pelo nome solto; aqui tudo é qualificado por owner (SWMS funciona).
- **Mesmas regras de tabela grande do dashboard** — acima de 1 mi de linhas, filtro/ordem só por coluna com índice líder; contagem pela estatística, nunca `COUNT(*)`.
- **Ligação inferida pelo nome no diagrama** — o Winthor quase não declara chave estrangeira (2 no LGCARVALHO para 15 chaves primárias). Coluna com o mesmo nome da chave primária de UMA coluna de outra tabela vira ligação inferida (`domain/diagrama.ts`); nomes genéricos (CODIGO, ID, NUMSEQ…), donos ambíguos e a própria chave da tabela ficam de fora. Traço diferente do declarado e desligável na tela.
- **Diagrama lê o schema inteiro de uma vez** — `BancoDeDadosPort.descreverSchema`: três consultas no schema em vez de quatro por tabela; guardado por 1h como o resto da estrutura.
- **Equipe do mapeamento** — `equipe.ts`: super admin + `dev@nasaerp.com`. Lista própria para a conta de dev não virar super admin do resto do sistema.
- **ERP desconhecido** — a estratégia não depende de conhecer o ERP: `buscar_colunas` acha candidatas pelo nome, `perfilar_coluna` confirma pelo CONTEÚDO (formato e distribuição), as conversões corrigem o que o nome esconde. Achados no Armazém que motivaram: CODAUXILIAR = EAN em 16 mil produtos e código interno repetido em ~6 mil; QTESTGER inclui reservado e bloqueado (Purelac 1kg filial 2: 6.800 total, 4.120 disponível); BLOQUEIO é crédito; CGCENT mistura com e sem máscara; região 1 = loja (filial 1), 9/11/2 = atacado (filial 2).
- **MCP é mais uma porta de entrada** — no Ports & Adapters ele é um adaptador "de entrada", como a tela: as ferramentas chamam os casos de uso de `application/`, e a tradução de erros é a mesma (`server/erros.ts`). Regra nova (tabela grande, validação) vale para os dois de uma vez.
- **Token do agente mora em `Device`** — sem tabela nova: plataforma `agente-ia`, escopo `mcp:mapeamento`, só o hash do token gravado, revogação e "visto por último". `verifyDeviceAuth` já revalida a cada chamada se o usuário segue na org; o MCP ainda reconfere `podeMapearBanco`. Escopos são fechados por padrão: o token não alcança nenhuma procedure do oRPC, e a lista de terminais do desktop esconde essa plataforma. As chaves do Órbita (`NasaIntegrationKey`) ficaram de fora de propósito: o card e o "revogar" do Órbita leem todas as chaves da org.
- **MCP sem sessão** — o app roda em mais de uma instância; cada requisição monta o servidor com as habilidades do token e responde em JSON.
- **Habilidade = escopo** — cada uma é um escopo + um arquivo em `src/features/mcp/server/habilidades/`, sem mexer nas existentes. Hoje: `mcp:mapeamento` (só lê o ERP) e `mcp:importacao` (grava no NERP). As duas têm o mesmo portão (equipe interna + admin da org), reconferido a cada chamada.
- **Importação: simular antes de gravar** — `simular_importacao` não grava nada e é o que o agente mostra ao usuário; `importar` exige `confirmado: true`. Gravar em lotes por chamada (e não num job): nenhuma chamada fica longa, uma queda não perde o que foi, e repetir um lote é seguro (vira "sem mudança").
- **Importação: o ERP só preenche o vazio** — o que alguém cadastrou ou corrigiu no NERP não é sobrescrito; só os FATOS do ERP (ativo/bloqueado lá) sempre atualizam. Um casamento errado polui milhares de cadastros, por isso as regras são puras e testadas sem banco.
- **Cliente ganhou `erpCode`** — coluna, não tabela: mesmo desenho do `Product.erpCode`. Casar só por CPF/CNPJ não basta (redes com o mesmo CNPJ em vários códigos, consumidor final sem documento).
- **"Automático" = perfil conhecido** — o Winthor traz perfis por tipo, em ordem de preferência; vale o primeiro cujas tabelas e colunas a credencial enxerga, e os recusados dizem por quê.

---

## Proximos passos

1. Dev revisa e commita a branch `feat/mapeamento-banco`; depois do deploy, aplicar as migrations (`pnpm db:deploy`) e repetir CA-5 no Armazém.
2. Syncs passam a ler pelo mapeamento (`lerMapeado`), começando por preço.
3. Ofertas no catálogo online (preço promocional cobrado e destacado) — spec `erp-sync-preco-vigente`, parada.

---

## Melhorias futuras (nao urgentes)

- [ ] Abrir para clientes (máscara de CPF/telefone na amostra antes disso).
- [ ] Migrar o `oracle-explorer` do dashboard para a mesma porta.
- [ ] Importar categoria, preço e promoção pelo MCP (hoje: produto, cliente e estoque).
- [ ] Portão próprio para a importação quando abrir para clientes (hoje é o mesmo do mapeamento).
- [ ] Ligar o Astro do NERP ao mesmo MCP.
- [ ] OAuth no MCP (hoje é token Bearer gerado na tela).
- [ ] Adaptadores para outros motores (Postgres, SQL Server, Firebird).
