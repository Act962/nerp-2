import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Cliente próprio: `@/lib/s3-client` traz `import "server-only"`, que não
// resolve fora do runtime do Next.
const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: false,
});

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
const PUBLIC_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
const MANIFEST_KEY = "releases/desktop/latest.json";

// Publica um instalador do app desktop (NERP Caixa) no bucket público e
// atualiza o manifesto que a página /aplicativos lê.
//
// Por que existe: sem isto, publicar versão vira upload manual + edição de JSON
// à mão, e o campo mais fácil de errar (tamanho/hash) é justamente o que o
// cliente usa para conferir o download. Aqui o hash e o tamanho saem do próprio
// arquivo enviado.
//
// Uso:
//   npx tsx scripts/publish-desktop-release.ts \
//     --file "../desktop/src-tauri/target/release/bundle/nsis/NERP Caixa_0.1.0_x64-setup.exe" \
//     --version 0.1.0 \
//     --notes "Primeira versão pública de testes."
//
//   # vários artefatos no mesmo release: repita --file (o manifesto acumula)
//
// Flags:
//   --file <caminho>   instalador a enviar (obrigatório, repetível)
//   --version <x.y.z>  versão do release (obrigatório)
//   --notes <texto>    "Nesta versão" mostrado na página (opcional)
//   --dry-run          mostra o manifesto resultante sem enviar nada

type Download = {
  label: string;
  os: "windows" | "macos" | "linux";
  format: string;
  url: string;
  size: number;
  sha256: string;
};

type Manifest = {
  version: string;
  publishedAt: string;
  notes?: string;
  downloads: Download[];
};

function parseArgs(argv: string[]) {
  const files: string[] = [];
  let version: string | undefined;
  let notes: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") files.push(argv[++i]);
    else if (arg === "--version") version = argv[++i];
    else if (arg === "--notes") notes = argv[++i];
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (files.length === 0) throw new Error("Informe ao menos um --file.");
  if (!version) throw new Error("Informe --version.");
  return { files, version, notes, dryRun };
}

// O que o Tauri gera hoje é Windows; os outros ficam aqui para o dia em que
// alguém empacotar mac/linux e não precisar reabrir esta decisão.
const FORMATS: Record<
  string,
  { os: Download["os"]; format: string; label: string; contentType: string }
> = {
  ".exe": {
    os: "windows",
    format: "nsis",
    label: "Windows 10/11 (64 bits)",
    contentType: "application/vnd.microsoft.portable-executable",
  },
  ".msi": {
    os: "windows",
    format: "msi",
    label: "Windows 10/11 (64 bits) — instalação corporativa (MSI)",
    contentType: "application/x-msi",
  },
  ".dmg": {
    os: "macos",
    format: "dmg",
    label: "macOS",
    contentType: "application/x-apple-diskimage",
  },
  ".appimage": {
    os: "linux",
    format: "appimage",
    label: "Linux (AppImage)",
    contentType: "application/octet-stream",
  },
};

/** Espaço no nome vira `%20` na URL e quebra `curl`/wget do cliente. */
function safeName(name: string): string {
  return name.replace(/\s+/g, "-");
}

async function readCurrentManifest(): Promise<Manifest | null> {
  try {
    const result = await S3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY }),
    );
    const body = await result.Body?.transformToString();
    return body ? (JSON.parse(body) as Manifest) : null;
  } catch {
    // Primeira publicação: o objeto não existe ainda.
    return null;
  }
}

async function main() {
  const { files, version, notes, dryRun } = parseArgs(process.argv.slice(2));

  if (!BUCKET || !PUBLIC_HOST) {
    throw new Error(
      "NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES e NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL precisam estar no apps/web/.env.",
    );
  }

  const current = await readCurrentManifest();
  // Republicar a MESMA versão (ex.: acrescentar o MSI depois do .exe) mantém os
  // artefatos já publicados; versão nova começa a lista do zero, senão o
  // download velho continuaria listado sob a versão nova.
  const carried = current?.version === version ? current.downloads : [];
  const downloads: Download[] = [...carried];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const meta = FORMATS[ext];
    if (!meta) throw new Error(`Extensão não suportada: ${ext} (${file})`);

    const body = await readFile(file);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const key = `releases/desktop/${version}/${safeName(basename(file))}`;
    const url = `https://${PUBLIC_HOST}/${key}`;

    if (!dryRun) {
      await S3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: meta.contentType,
          // Imutável: a chave carrega a versão, então o arquivo nunca muda.
          CacheControl: "public, max-age=31536000, immutable",
          ContentDisposition: `attachment; filename="${safeName(basename(file))}"`,
        }),
      );
    }
    console.log(
      `${dryRun ? "[simulação] " : ""}enviado ${key} (${(body.length / 1048576).toFixed(1)} MB)`,
    );

    // Reenviar o mesmo formato substitui a entrada em vez de duplicá-la.
    const index = downloads.findIndex(
      (d) => d.os === meta.os && d.format === meta.format,
    );
    const entry: Download = {
      label: meta.label,
      os: meta.os,
      format: meta.format,
      url,
      size: body.length,
      sha256,
    };
    if (index >= 0) downloads[index] = entry;
    else downloads.push(entry);
  }

  const manifest: Manifest = {
    version,
    publishedAt: new Date().toISOString(),
    ...(notes
      ? { notes }
      : current?.version === version && current.notes
        ? { notes: current.notes }
        : {}),
    downloads,
  };

  if (!dryRun) {
    await S3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: MANIFEST_KEY,
        Body: JSON.stringify(manifest, null, 2),
        ContentType: "application/json",
        // Ao contrário dos binários, este objeto MUDA a cada release — cache
        // longo aqui congelaria a página numa versão antiga.
        CacheControl: "public, max-age=60",
      }),
    );
  }

  console.log(`\n${dryRun ? "[simulação] " : ""}manifesto ${MANIFEST_KEY}:`);
  console.log(JSON.stringify(manifest, null, 2));
  console.log(
    `\nPágina: /aplicativos · link estável: /api/desktop/download?os=windows`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
