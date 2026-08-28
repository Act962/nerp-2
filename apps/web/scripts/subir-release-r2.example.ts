import { publishDesktopRelease } from "./publish-desktop-release";

/**
 * MOLDE. Copie para `subir-release-r2.ts` (mesma pasta), cole os valores e rode:
 *
 *   cd apps/web
 *   pnpm release:desktop
 *
 * O `subir-release-r2.ts` é IGNORADO pelo git — as credenciais coladas aqui não
 * saem da sua máquina. Não renomeie para outra coisa, ou elas viram commit.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1) CREDENCIAIS DO R2 — copie do Coolify (ambiente de PRODUÇÃO)
// ─────────────────────────────────────────────────────────────────────────────
const R2 = {
  accessKeyId: "",
  secretAccessKey: "",

  // AWS_ENDPOINT_URL_S3 — ex.: "https://<id-da-conta>.r2.cloudflarestorage.com"
  endpoint: "",

  // NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES — o bucket onde o arquivo é gravado.
  bucket: "",

  // NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL — domínio público, SEM "https://".
  // Tem de ser EXATAMENTE o mesmo valor que o servidor de produção usa: é dele
  // que o servidor deriva onde procurar o manifesto. Divergiu, a página fica em
  // "Nenhuma versão publicada" e não aparece erro nenhum para explicar.
  publicHost: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) O QUE PUBLICAR
// ─────────────────────────────────────────────────────────────────────────────
const VERSAO = "0.1.0";

const NOTAS = "Primeira versão pública de testes.";

// Caminhos relativos a `apps/web/`. Gere com:
//   pnpm --filter @nerp/desktop release:win
const ARQUIVOS = [
  "../desktop/src-tauri/target/release/bundle/nsis/NERP Caixa_0.1.0_x64-setup.exe",
  "../desktop/src-tauri/target/release/bundle/msi/NERP Caixa_0.1.0_x64_en-US.msi",
];

// ─────────────────────────────────────────────────────────────────────────────
// 3) Deixe `true` na primeira rodada: mostra bucket, domínio e o manifesto que
//    seria gravado, sem enviar nada. Confira e só então mude para `false`.
// ─────────────────────────────────────────────────────────────────────────────
const SIMULAR = true;

publishDesktopRelease({
  credentials: R2,
  files: ARQUIVOS,
  version: VERSAO,
  notes: NOTAS,
  dryRun: SIMULAR,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
