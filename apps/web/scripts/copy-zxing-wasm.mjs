// Copia o WASM do leitor de código de barras para /public.
//
// O `barcode-detector` (usado como fallback onde não existe a API nativa
// BarcodeDetector — iOS Safari, Firefox) busca esse arquivo no jsDelivr por
// padrão. Servir do nosso próprio domínio tira um CDN de terceiro do caminho de
// uma tela pública de loja e evita quebrar em rede que bloqueia CDN.
//
// A cópia é feita a partir do pacote instalado, e não de um binário versionado,
// porque o .wasm e o JS que o carrega precisam ser da MESMA versão — um wasm
// commitado silenciosamente desatualiza quando a dependência sobe.

import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// Resolvido a partir do próprio barcode-detector: com pnpm o zxing-wasm fica
// na árvore isolada dele, não na raiz de node_modules.
const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm", {
  paths: [dirname(require.resolve("barcode-detector"))],
});

const target = join(process.cwd(), "public", "wasm", "zxing_reader.wasm");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

console.log(`zxing_reader.wasm → ${target}`);
