# Specs

Registro de melhorias, correções e atualizações pendentes por feature.

Cada arquivo documenta o que precisa ser feito em uma área do sistema, com
checkboxes para acompanhar o progresso. Use como referência ao retomar uma
feature depois de trabalhar em outra coisa.

## Fundacao

- [`VISAO-PRODUTO.md`](./VISAO-PRODUTO.md) — Visao do Orbita ERP: 4 pilares, 7 modulos, estrategia, regras para decisoes tecnicas
- [`MAPA-PROJETO.md`](./MAPA-PROJETO.md) — Indice completo: apps, features, rotas, docs, glossario
- [`_TEMPLATE.md`](./_TEMPLATE.md) — Template padrao para novos specs
- [`COMO-SOLICITAR.md`](./COMO-SOLICITAR.md) — Guia de como formular requisicoes eficientes

## Specs por feature

- [`dashboard.md`](./dashboard.md) — Dashboard pessoal + org + publico: 18 widgets, Oracle, alertas, pendencias
- [`fornecedores.md`](./fornecedores.md) — CRUD de fornecedores (segurança, busca, refatoração)
- [`importacao-fornecedores.md`](./importacao-fornecedores.md) — Importação via planilha (✅ entregue)
- [`catalogo-editor-canva.md`](./catalogo-editor-canva.md) — Editor de Catálogo estilo Canva: 4 camadas, seleção/nós, painel de propriedades, grupo container · `feat/catalogo-paginas-canva` · 🟡 Fases 1-5 entregues
- [`catalogo-precos-livre.md`](./catalogo-precos-livre.md) — Construtor "Padrão de estilos de preços" como canvas livre: variáveis (Preço/Nome/Foto/SKU/…) + formas com drag/resize, padrão reutilizável · `feat/catalogo-precos-livre` · 📋 Planejado
- [`catalogo-multi-grupo.md`](./catalogo-multi-grupo.md) — Página com múltiplos grupos de produtos (duplicar grupo) + blocos de estilo individuais posicionáveis · `feat/catalogo-paginas-canva` · 🟡 Fases 1 e 3 entregues (Fase 2 = atribuição manual de produtos, pendente)
- [`catalogo-filtros-oracle.md`](./catalogo-filtros-oracle.md) — "Adicionar produto": filtro por categoria (✅ entregue) + buscas Oracle (mais vendidos, vencimento, giro) · `feat/catalogo-filtros-oracle` · 🟡 categoria pronta; buscas Oracle planejadas
- [`catalogo-link-publico.md`](./catalogo-link-publico.md) — Compartilhar: escolher página + link público do catálogo + WhatsApp com link · `feat/catalogo-paginas-canva` · 🟢 entregue (token no config, sem migration)
- [`catalogo-lista.md`](./catalogo-lista.md) — Aba "Lista": planilha/PDF/imagem (IA Gemini) → catálogo com 1 página por cliente, preços por linha, imagens casadas por nome · `feat/catalogo-lista` · 🟢 MVP entregue (Fases 1-4, sem migration)

## ERP — Núcleo de varejo (roadmap)

> Roadmap de paridade de mercado (referências SIC/CEFAS), mantendo a UI simples. Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada spec = 1 branch = 1 PR.

- [`pdv-caixa.md`](./pdv-caixa.md) — **(1)** Frente de caixa: sessão (abertura/fechamento/sangria/suprimento) + níveis operador/caixa · `feat/pdv-caixa` · 📋 detalhado
- [`pagamentos-gateway.md`](./pagamentos-gateway.md) — **(2)** Gateway PIX/boleto/cartão (Asaas/Stripe, port `nasaex-wey`) · `feat/pagamentos-gateway` · 📋 esboço
- [`financeiro-contas.md`](./financeiro-contas.md) — **(3)** Contas a pagar/receber + régua de cobrança (port `nasaex-wey`) · `feat/financeiro-contas` · 📋 esboço
- [`fiscal-tributacao.md`](./fiscal-tributacao.md) — **(4)** Cadastro tributário + reforma IBS/CBS (fundação fiscal) · `feat/fiscal-tributacao` · 📋 esboço
- [`fiscal-emissao.md`](./fiscal-emissao.md) — **(5)** Emissão NFe/NFCe via provedor · `feat/fiscal-emissao` · 📋 esboço · depende de (4)
- [`impressao-cupom.md`](./impressao-cupom.md) — **(6)** ESC-POS/PDF/DANFE + editor de cupom · `feat/impressao-cupom` · 📋 esboço · depende de (1)/(5)
- [`pdv-atalhos-ui.md`](./pdv-atalhos-ui.md) — **(7)** Atalhos globais (F8/F11…) + refino da UI do PDV · `feat/pdv-atalhos-ui` · 📋 esboço · depende de (1)
- [`pdv-offline.md`](./pdv-offline.md) — **(8)** Offline transparente do PDV (PWA + outbox + sync) · `feat/pdv-offline` · 📋 esboço · depende de (1)
