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
