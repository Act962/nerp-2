# Desktop — Fase 1: online-only (implementado)

> App desktop (Tauri + Vite + React) que **pareia e vende com internet**, consumindo a API via `@nerp/api`. De-risca empacotamento, auth e CORS antes do offline.
> Feature: `apps/desktop` (novo) · `device.pairWithCredentials` (novo procedure) · `apps/web` (só adições)
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Implementado na branch `feat/desktop-fase-1` (build, check-types e verificação no navegador). Falta abrir o PR.

---

## O que foi entregue

**App `apps/desktop`** (Vite + React SPA; o Tauri é só o shell nativo):
- `lib/client.ts` — cliente oRPC tipado (`@nerp/api`), base URL por env (`VITE_NERP_API_URL`), bearer do token-store.
- `lib/token-store.ts` — guarda a sessão do device (Fase 1: `localStorage`; keychain fica p/ Fase 4).
- `features/login` — pareamento por credenciais (`device.pairWithCredentials`).
- `features/pdv` — busca de produtos online (`products.list`), com indicador Online e logout.
- `src-tauri/` — scaffold Tauri v2 (Cargo, `tauri.conf.json`, capabilities). **Não compilado aqui** (sem Rust nesta máquina); pronto para `tauri dev` após instalar a toolchain.

**Servidor (aditivo em `apps/web`):**
- `device.pairWithCredentials` — o "login" do desktop: verifica e-mail/senha pelo Better Auth (`signInEmail`), resolve a org por membership e devolve o token **no corpo**. Passa inteiro pelo `/api/rpc` (CORS da Fase 0), **sem cookie** — mata o problema de cookie cross-origin.

## Decisões tomadas

- **Login por credenciais → token no corpo**, não sessão por cookie. É o fluxo correto de app nativo e reusa o CORS do `/api/rpc` sem tocar em `/api/auth`.
- **Desktop tipa um contrato ENXUTO (`DesktopApi`), não o `AppRouter` inteiro.** Importar `typeof router` do FONTE faz o tsc do desktop compilar toda a árvore do servidor (Prisma, `@/…`, server-only) — inaceitável. A inferência total cruzando a fronteira de projeto exige o router num package que emita `.d.ts`; isso fica para a **Fase 5**. `@nerp/api` virou genérico sobre o TIPO DO CLIENTE (aceita `RouterClient<AppRouter>` no mesmo processo e o contrato enxuto fora dele). Drift do contrato é coberto por testes de integração.
- **Verificação do frontend no navegador** — o SPA roda igual no browser e na webview do Tauri; sem Rust, é onde se valida de ponta a ponta.

## Verificação (tudo verde)

- `pnpm check-types` (7 workspaces, inclui `@nerp/desktop`) · `pnpm build` do desktop (55 módulos, ~213 KB — **zero** código de servidor no bundle) · lint.
- Integração `device-pair-credentials.test.ts` (3): credencial correta → token que autentica; senha errada → recusa; org alheia → recusa.
- **Navegador** (desktop no :5173 contra o web no :3000, DB local):
  - login inválido → **preflight OPTIONS 204** + **POST 401** cross-origin + erro "E-mail ou senha inválidos" na UI;
  - com token de device → **PDV lista produtos** (`products/list` 200, bearer + CORS), header com o nome da org, busca filtrando por termo, tudo scoped à org do device.

## Próximo passo

**Fase 2** — banco local (SQLite + Drizzle) e leitura offline (pull incremental de catálogo/preços). Ver `specs/desktop-offline.md`.

## Em aberto

- [ ] Storage seguro do token (keychain) — hoje `localStorage` (Fase 4).
- [ ] Origens do Tauri por SO em produção (`DESKTOP_ALLOWED_ORIGINS`).
- [ ] Ícones do bundle (`apps/desktop/src-tauri/icons/` vazio — rodar `tauri icon`).
