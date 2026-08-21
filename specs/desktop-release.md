# Release / distribuição do app desktop — checklist

> O que falta para o instalador do NERP Caixa sair de "build de teste local" para **distribuição pública** numa máquina de caixa real. Foco no que bloqueia de verdade (assinatura, URL de produção), não só no visual.
> Feature: `apps/desktop/src-tauri/tauri.conf.json` + `.nixpacks`/deploy do backend + `apps/desktop/src/lib/config.ts`
> Criado em: 2026-08-21 · Atualizado em: 2026-08-21
> Status: 📋 planejado — não iniciar sem decisão de publicar

---

## Situacao atual

O `tauri build --bundles nsis` já gera um instalador Windows funcional (NSIS `.exe`,
x64, ~3 MB), com ícone e assistente de instalação brandados (marca NERP). Mas é um
**build de teste**: aponta para `http://localhost:3000`, **não é assinado**, e não
tem auto-update. Nesse estado, numa máquina de caixa real ele (a) não acha o
backend e (b) dispara o aviso "Editor desconhecido" do SmartScreen.

Arquivos principais:
- `apps/desktop/src-tauri/tauri.conf.json` — `bundle` (targets, icon, `windows.nsis`).
- `apps/desktop/src/lib/config.ts` — `API_URL = VITE_NERP_API_URL ?? "http://localhost:3000"` (URL assada no build).
- `apps/web/src/lib/desktop-cors.ts` — allowlist `DESKTOP_ALLOWED_ORIGINS` (CORS do device).

---

## Pendencias

### Critico (bloqueiam a distribuição)

- [ ] **Assinatura de código (Authenticode)** — sem assinar, o Windows mostra "Windows protegeu seu PC / Editor desconhecido" (SmartScreen) e o navegador avisa no download. Precisa de certificado de code-signing (DigiCert/Sectigo) **ou** Azure Trusted Signing (mais barato, recomendado). Assinar via `bundle.windows.certificateThumbprint`/`signCommand` no build. **EV** ganha reputação SmartScreen na hora; **OV** ganha com o tempo/downloads. É o maior bloqueador — mais importante que qualquer ajuste visual.
- [ ] **URL de produção assada no build** — o release precisa de `VITE_NERP_API_URL=<url pública do backend>` no build (hoje cai no default `localhost:3000`). Sem isso o app não fala com o servidor.
- [ ] **CORS de produção libera `http://tauri.localhost`** — o app instalado (Tauri v2 Windows) manda `Origin: http://tauri.localhost`. O `DESKTOP_ALLOWED_ORIGINS` de produção (Coolify) TEM de incluir esse valor. O valor com só `https://tauri.localhost` bloqueia o pareamento (bug real já reproduzido em dev, corrigido lá no `.env.local`).

### Funcional

- [ ] **Metadados do `.exe`** (Editor/Produto/Copyright nas propriedades do arquivo) — dá credibilidade e ajuda na reputação SmartScreen.
- [ ] **Auto-update** — plugin updater do Tauri (endpoint/JSON + updates assinados) para a máquina de caixa se atualizar sozinha, sem reinstalar. Depende da assinatura.
- [ ] **`installMode`** — decidir `currentUser` (sem admin) × `perMachine` (com admin) × `both`. Caixa costuma querer `perMachine`.
- [ ] **MSI (WiX)** além do NSIS — se houver deploy corporativo (GPO). `targets: "all"` já gera os dois; validar o MSI.

### UX

- [ ] **Instalador em pt-BR** — hoje o assistente é em inglês ("Welcome to…"). `bundle.windows.nsis.languages: ["PortugueseBR"]` (+ seletor opcional).
- [ ] **Página de termos** — `licenseFile` no bundle, se for necessário aceite.
- [ ] **Template NSIS custom** (opcional) — `bundle.windows.nsis.template` aponta para um `.nsi` próprio para mudar páginas/fluxo/visual além das imagens. Retorno decrescente perto da assinatura; só se quiserem um instalador realmente sob medida.

### Qualidade de codigo

- [ ] **Pipeline de build de release** — script/CI que assa a URL prod, assina, versiona e publica o artefato (evita build manual propenso a erro, como o bake de localhost).

---

## Decisoes tomadas

- **Instalador NSIS `.exe` é o alvo primário** (auto-baixado pelo Tauri, mais flexível). MSI fica como extra para cenário corporativo.
- **Visual do assistente já brandado** (sidebar/header/ícone NERP, derivados do favicon do web) — ver commit `5e8a0ed`. Mudar o "padrão NSIS" além disso é possível (config → template custom), mas não é prioridade.
- **A URL do backend é assada em build-time** (decisão de `config.ts`) — logo, cada ambiente (teste × produção) é um build distinto; não há troca de servidor em runtime.

---

## Proximos passos (quando decidirem publicar)

1. Escolher o mecanismo de assinatura (Azure Trusted Signing × certificado EV/OV) e assinar o build.
2. Definir a URL pública do backend e assá-la (`VITE_NERP_API_URL`) num build de release.
3. Garantir `DESKTOP_ALLOWED_ORIGINS` de produção com `http://tauri.localhost`.
4. Preencher metadados do `.exe` (editor/copyright).
5. Instalador em pt-BR + `installMode` definido.
6. (Depois) auto-update assinado + pipeline de release.

---

## Fora de escopo

- Distribuição fora do Windows (macOS/Linux) — o app roda em Windows de caixa.
- Publicação em loja (Microsoft Store / MSIX) — a menos que se decida por esse canal.
- Template NSIS totalmente custom, enquanto a assinatura não estiver resolvida.

---

## Relação com outros specs

- `desktop-offline.md` / `desktop-fase-*.md` — o app que está sendo empacotado.
- `desktop-pagamento-eletronico.md` — o corte do TEF real também é build-time (adapter), então entra na mesma disciplina de "um build por ambiente".
