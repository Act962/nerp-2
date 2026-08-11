# Catálogo Online via caminho de URL

## Contexto

O catálogo online (storefront público) hoje é acessado por subdomínio dedicado
por organização — `https://{subdomain}.dominio.com`. Isso depende de DNS
wildcard e SSL wildcard configurados no host. **Esse recurso está indisponível
no ambiente atual**, deixando organizações sem uma URL pública para o próprio
catálogo.

Precisamos de uma segunda estratégia que funcione sem depender de
subdomínio, mantendo a mesma experiência pública do storefront atual.

## Solução

Expor o mesmo catálogo por um caminho na URL do domínio principal:

- Rota pública: `https://dominio.com/catalogo/{slug}` onde `{slug}` é o
  `Organization.subdomain` (mesmo valor que o admin já cadastrou pro modo
  subdomínio — evita novo campo e migration).
- Todo o resto do storefront segue relativo: produto vira
  `dominio.com/catalogo/{slug}/{productSlug}`, carrinho vira
  `dominio.com/catalogo/{slug}/cart`, e assim por diante.
- Aviso no admin `/catalogo` de que o subdomínio está indisponível, com
  cópia sugerindo o novo caminho.
- Catálogo continua **público** (sem auth), como já era via subdomínio.

Coexistência: os dois modos podem operar juntos no futuro. Quando o
subdomínio voltar a ser suportado, `subdomain.dominio.com/*` continua
funcionando via rewrite do middleware; `dominio.com/catalogo/{slug}/*`
também.

## Escopo

### 1. Rota pública nova `/catalogo/[slug]/**`

Reusa 100% dos componentes do storefront atual (`src/app/(storefront)/[subdomain]/`):
home, listagem, [productSlug], cart, checkout, account, sign-in, sign-up,
sobre-nos.

**Duas abordagens em avaliação:**

- **A) Rewrite via middleware** — o middleware detecta o prefixo
  `/catalogo/{slug}` e reescreve internamente pra `/{slug}/{restante}`,
  aproveitando a rota `(storefront)/[subdomain]/...` que já existe. Zero
  duplicação de UI. **Requer** que os `<Link href>` internos do storefront
  usem prefixo (útil ler o `pathname` corrente pra decidir se é modo
  subdomínio ou caminho — o `basePath` fica embutido no `pathname` que o
  Next envia).
- **B) Rota espelhada** `(storefront)/catalogo/[slug]/[[...rest]]/page.tsx`
  captura tudo e delega pro mesmo componente que a rota subdomínio usa.
  Mais explícito, custo maior de setup.

**Decisão preferida:** A (rewrite). Fica idiomático com o middleware que já
faz o mesmo pra subdomínio.

**Cuidado com colisão:** o admin autenticado hoje já é `/catalogo` (sem
slug). A convenção fica:

- `/catalogo` (sem segmento) → admin autenticado (mantido).
- `/catalogo/{slug}` (com segmento) → storefront público. O middleware
  detecta o prefixo antes que a rota admin capture.

O middleware precisa **não** repassar pro admin quando existir um segmento
depois de `/catalogo/` que case com o `subdomain` de alguma org.

### 2. Aviso no admin

Na página `/catalogo` (admin) mostrar um banner **destacado** informando:

- Subdomínio está indisponível neste ambiente.
- Enquanto isso, o catálogo pode ser acessado via caminho:
  `https://dominio.com/catalogo/{subdomain}`.
- Botão "Copiar link".

Copy sugerido:
> **Subdomínio indisponível.** Enquanto habilitamos o subdomínio deste
> ambiente, seu catálogo online já está no ar em `dominio.com/catalogo/{slug}`.
> Compartilhe esse link com seus clientes.

### 3. Links internos do storefront

Os `<Link>` dentro do storefront precisam funcionar nos DOIS modos sem
saber qual está em uso. Estratégia:

- Todos os `href` internos usam paths **relativos ao slug**
  (`{slug}/produto/x`, `{slug}/cart`). O Next renderiza o path final
  correto porque o slug faz parte da URL desde a rota
  `(storefront)/[subdomain]/`.
- Componentes que precisem construir URL absoluta (ex.: compartilhar link
  do produto no WhatsApp) usam um helper `catalogUrl(slug, path)` que lê
  `NEXT_PUBLIC_BASE_DOMAIN` + prefixa `/catalogo/{slug}` no modo caminho.

### 4. SEO / canonical

Enquanto o subdomínio estiver indisponível:

- `/catalogo/{slug}` é o canonical do catálogo.
- Adicionar `<link rel="canonical" href="https://dominio.com/catalogo/{slug}">`
  em cada página do storefront.

Quando o subdomínio voltar:

- Escolher UM canonical (subdomínio ou caminho) e redirecionar o outro
  com 301 (evitar duplicate content).

## Não-escopo

- Novo campo `Organization.slug` — reusamos `subdomain`.
- Reescrita da UI do storefront.
- Reescrita do checkout, autenticação, carrinho.
- Redirect automático de `subdomain.dominio.com` pro caminho quando o
  subdomínio voltar — decisão de infra futura.

## Verificação

- Manual: abrir `http://localhost:3000/catalogo/gotham` → home do
  catálogo da Gotham carrega, produtos aparecem, click num produto vai
  pra `/catalogo/gotham/{productSlug}`, adicionar ao carrinho, ir pro
  checkout — tudo funcionando sem sessão logada.
- Manual: acessar `http://gotham.localhost:3000/` → mesmo comportamento
  (compatibilidade com subdomínio preservada, tanto no dev com
  wildcard local quanto em produção quando o wildcard voltar).
- Manual: admin em `/catalogo` mostra o banner com o link
  `dominio.com/catalogo/gotham` e o botão "Copiar link" funciona.
- Manual: acessar `/catalogo/naoexiste` → 404 (org não encontrada).
- `npx tsc --noEmit` e `pnpm lint` limpos.

## Branch/PR

`feat/catalogo-por-url` → PR separada contra `main` (regra
`1 spec = 1 branch = 1 PR`). Sem dependência de outras PRs abertas.
