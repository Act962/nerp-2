# Release / distribuição do app desktop — checklist

> O que falta para o instalador do NERP Caixa sair de "build de teste local" para **distribuição pública** numa máquina de caixa real. Foco no que bloqueia de verdade (assinatura, URL de produção), não só no visual.
> Feature: `apps/desktop/src-tauri/tauri.conf.json` + `apps/desktop/.env.production` + `apps/web/src/features/aplicativos/`
> Criado em: 2026-08-21 · Atualizado em: 2026-08-28
> Status: 🚧 em andamento — release público de TESTE liberado, sem assinatura

---

## Situacao atual

O `tauri build` gera um instalador Windows funcional (NSIS `.exe` + MSI, x64,
~3 MB), com ícone e assistente brandados (marca NERP), assistente em **pt-BR**,
metadados de editor/copyright preenchidos e a **URL de produção assada**
(`https://nerp.nasaex.com`). O que ainda falta para ser um release "de verdade"
é a **assinatura de código** — sem ela o Windows mostra "Editor desconhecido"
(SmartScreen). A decisão tomada foi **publicar assim mesmo**, como versão de
testes para clientes, com a página de download explicando o aviso.

Arquivos principais:
- `apps/desktop/.env.production` — `VITE_NERP_API_URL` do release (**versionado**).
- `apps/desktop/vite.config.ts` — guarda que **quebra o build** de produção se a URL estiver vazia ou apontando para localhost.
- `apps/desktop/src-tauri/tauri.conf.json` — `bundle` (targets, metadados, `windows.nsis`).
- `apps/web/src/lib/desktop-cors.ts` — allowlist; as origens do Tauri são **embutidas**.
- `apps/web/src/lib/desktop-release.ts` — leitor do manifesto do release.
- `apps/web/scripts/publish-desktop-release.ts` — publica instalador + manifesto no R2.
- `apps/web/src/features/aplicativos/` — a página `/aplicativos` de download.

---

## Como publicar uma versão

```bash
# 1) build do instalador (Windows, com a toolchain Rust instalada)
pnpm --filter @nerp/desktop release:win

# 2) publicar no bucket + atualizar o manifesto que a página lê
cd apps/web
npx tsx scripts/publish-desktop-release.ts \
  --file "../desktop/src-tauri/target/release/bundle/nsis/NERP Caixa_0.1.0_x64-setup.exe" \
  --version 0.1.0 \
  --notes "Primeira versão pública de testes."
```

O script calcula tamanho e SHA-256 do próprio arquivo enviado (os dois campos
mais fáceis de errar à mão, e justamente os que o cliente usa para conferir o
download), grava o binário em `releases/desktop/<versão>/` com cache imutável e
reescreve `releases/desktop/latest.json` com cache curto. Use `--dry-run` para
ver o manifesto resultante sem enviar nada, e repita `--file` para acrescentar o
MSI ao mesmo release.

Publicar **não exige deploy do web, migration nem reiniciar nada**: a página lê
o manifesto do bucket com 5 min de cache.

Versionamento: bumpar a versão em **dois** lugares — `apps/desktop/package.json`
e `apps/desktop/src-tauri/tauri.conf.json` — e passar a mesma em `--version`.

---

## Pendencias

### Critico (bloqueiam a distribuição)

- [ ] **Assinatura de código (Authenticode)** — sem assinar, o Windows mostra "Windows protegeu seu PC / Editor desconhecido" (SmartScreen) e o navegador avisa no download. Precisa de certificado de code-signing (DigiCert/Sectigo) **ou** Azure Trusted Signing (mais barato, recomendado). Assinar via `bundle.windows.certificateThumbprint`/`signCommand` no build. **EV** ganha reputação SmartScreen na hora; **OV** ganha com o tempo/downloads. Continua sendo o maior bloqueador para uma distribuição ampla — a página `/aplicativos` hoje só *explica* o aviso.
- [x] **URL de produção assada no build** — `apps/desktop/.env.production` (versionado) fixa `VITE_NERP_API_URL=https://nerp.nasaex.com`, e o `vite.config.ts` quebra o build de produção se a URL estiver vazia ou for localhost. Era o modo de falha mais caro: só aparecia na máquina do cliente, como "não consigo parear".
- [x] **CORS de produção libera `http://tauri.localhost`** — as três origens fixas da webview do Tauri (`http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`) passaram a ser **embutidas** em `desktop-cors.ts`. Não dependem mais de ninguém lembrar de pô-las no `DESKTOP_ALLOWED_ORIGINS` do Coolify. Não afrouxa nada: o CORS não é a fronteira de segurança aqui — a fronteira é o bearer por device, e `Allow-Credentials` continua `false`.

### Funcional

- [x] **Metadados do `.exe`** — `publisher`, `copyright`, `homepage`, `shortDescription`/`longDescription` e `category` no `bundle`. ⚠️ **Confirmar o `publisher`**: está `"NASA Sistemas"`, um chute a partir do domínio; deve ser a razão social que vai aparecer nas propriedades do arquivo (e, no futuro, casar com o nome do certificado).
- [x] **`installMode`** — `"both"`: o assistente deixa o usuário escolher "para todos os usuários" (com admin) × "só para mim". `perMachine` puro é o ideal numa máquina de caixa, mas travaria o tester sem admin, que é exatamente o público deste release.
- [x] **MSI (WiX) além do NSIS** — `targets: "all"` gera os dois; `release:win` empacota `nsis,msi` explicitamente. O script de publicação aceita os dois no mesmo release.
- [ ] **Auto-update** — plugin updater do Tauri (endpoint/JSON + updates assinados) para a máquina de caixa se atualizar sozinha, sem reinstalar. Depende da assinatura. O manifesto que já existe (`latest.json`) é o ponto natural de partida — hoje ele tem versão/URL/tamanho/SHA-256, falta o formato e a assinatura que o updater espera.

### UX

- [x] **Instalador em pt-BR** — `bundle.windows.nsis.languages: ["PortugueseBR"]`, sem seletor de idioma.
- [x] **Página de download no ERP** — `/aplicativos` (chave de permissão `aplicativos`, no grupo "Apps" da sidebar): versão, data, tamanho, SHA-256 copiável, botão de download, o que muda na versão, como instalar/parear, o que funciona offline e a explicação do aviso do SmartScreen. Link estável para mandar por WhatsApp/chamado: `/api/desktop/download?os=windows` (aberto, redireciona 302 para a URL versionada — o binário no bucket já é público e sozinho não dá acesso a nada).
- [ ] **Página de termos** — `licenseFile` no bundle, se for necessário aceite.
- [ ] **Template NSIS custom** (opcional) — `bundle.windows.nsis.template` aponta para um `.nsi` próprio para mudar páginas/fluxo/visual além das imagens. Retorno decrescente perto da assinatura; só se quiserem um instalador realmente sob medida.

### Qualidade de codigo

- [x] **Publicação roteirizada** — `scripts/publish-desktop-release.ts` faz upload + manifesto num comando só.
- [ ] **CI de release** — hoje o `tauri build` ainda é rodado à mão numa máquina Windows com a toolchain Rust. Um job de CI que builda, assina e chama o script de publicação fecha o ciclo. Depende da assinatura para valer a pena.

---

## Decisoes tomadas

- **Instalador NSIS `.exe` é o alvo primário** (auto-baixado pelo Tauri, mais flexível). MSI fica como extra para cenário corporativo.
- **Visual do assistente já brandado** (sidebar/header/ícone NERP, derivados do favicon do web) — ver commit `5e8a0ed`.
- **A URL do backend é assada em build-time** (decisão de `config.ts`) — cada ambiente é um build distinto; não há troca de servidor em runtime. Como isso já produziu um instalador apontando para `localhost:3000`, a URL de produção passou a ser **versionada** em `.env.production` (exceção explícita no `.gitignore` da raiz: não é segredo) e o build de produção **falha** se ela sumir ou virar localhost.
- **Os binários moram no bucket público (R2), não no repositório nem no banco.** Não há model `DesktopRelease` no Prisma: o release não é dado de inquilino, é o mesmo binário para todas as organizações. O estado do release vive num `latest.json` no bucket, então publicar não passa por migration nem deploy.
- **Publicar sem assinar**, como release de testes, com a página explicando o "Mais informações → Executar assim mesmo" e oferecendo o SHA-256 para conferência. A alternativa (segurar tudo até ter certificado) adiava o teste com cliente por causa de uma compra.

---

## Proximos passos

1. Confirmar/corrigir o `publisher` no `tauri.conf.json` (razão social).
2. Gerar o primeiro instalador de release numa máquina com a toolchain Rust e publicá-lo com o script.
3. Escolher o mecanismo de assinatura (Azure Trusted Signing × certificado EV/OV) e assinar os builds seguintes.
4. (Depois da assinatura) auto-update em cima do `latest.json` + CI de release.

---

## Fora de escopo

- Distribuição fora do Windows (macOS/Linux) — o app roda em Windows de caixa. O manifesto e o script já aceitam os dois, mas ninguém empacota.
- Publicação em loja (Microsoft Store / MSIX) — a menos que se decida por esse canal.
- Template NSIS totalmente custom, enquanto a assinatura não estiver resolvida.

---

## Relação com outros specs

- `desktop-offline.md` / `desktop-fase-*.md` — o app que está sendo empacotado.
- `desktop-pagamento-eletronico.md` — o corte do TEF real também é build-time (adapter), então entra na mesma disciplina de "um build por ambiente". **Enquanto não existir esse adapter, o pagamento do app é o processador Mock** (`apps/desktop/src/lib/payment.ts`): quem testar o release não tem maquininha de verdade.
