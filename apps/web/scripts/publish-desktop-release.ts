import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Publica um instalador do app desktop (NERP Caixa) no bucket público e
 * atualiza o manifesto que a página `/aplicativos` lê.
 *
 * Isto é a BIBLIOTECA — não roda sozinha. Quem chama é
 * `scripts/subir-release-r2.ts` (ignorado pelo git, com as credenciais coladas
 * à mão); o molde dele é `subir-release-r2.example.ts`.
 *
 * Por que existe: sem isto, publicar vira upload manual + edição de JSON à mão,
 * e o campo mais fácil de errar (tamanho/hash) é justamente o que o cliente usa
 * para conferir o download. Aqui os dois saem do próprio arquivo enviado.
 */

const MANIFEST_KEY = "releases/desktop/latest.json";

export type R2Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  /** Endpoint S3 do R2 (`https://<conta>.r2.cloudflarestorage.com`). */
  endpoint: string;
  /** Bucket onde o arquivo é gravado. */
  bucket: string;
  /** Domínio público do bucket, SEM `https://` — vira a URL de download. */
  publicHost: string;
};

export type PublishOptions = {
  credentials: R2Credentials;
  /** Caminhos dos instaladores (.exe / .msi / .dmg / .AppImage). */
  files: string[];
  version: string;
  notes?: string;
  /** `true` = não envia nada, só mostra o que faria. */
  dryRun: boolean;
};

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

async function readCurrentManifest(
  s3: S3Client,
  bucket: string,
): Promise<Manifest | null> {
  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: MANIFEST_KEY }),
    );
    const body = await result.Body?.transformToString();
    return body ? (JSON.parse(body) as Manifest) : null;
  } catch {
    // Primeira publicação: o objeto não existe ainda.
    return null;
  }
}

export async function publishDesktopRelease({
  credentials,
  files,
  version,
  notes,
  dryRun,
}: PublishOptions): Promise<Manifest> {
  const faltando = (
    [
      "accessKeyId",
      "secretAccessKey",
      "endpoint",
      "bucket",
      "publicHost",
    ] as const
  ).filter((key) => !credentials[key]?.trim());
  if (faltando.length > 0) {
    throw new Error(
      `Credenciais do R2 incompletas — preencha: ${faltando.join(", ")}`,
    );
  }
  if (files.length === 0) throw new Error("Nenhum arquivo para publicar.");
  if (!version.trim()) throw new Error("Informe a versão do release.");

  const s3 = new S3Client({
    region: "auto",
    endpoint: credentials.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  // O erro caro aqui é publicar no bucket errado — some sem mensagem, e a
  // página só diz "Nenhuma versão publicada". Mostrar o destino ANTES de
  // enviar é o que dá chance de perceber.
  console.log(`${dryRun ? "SIMULAÇÃO — nada será enviado\n" : ""}`);
  console.log(`bucket:  ${credentials.bucket}`);
  console.log(`domínio: https://${credentials.publicHost}`);
  console.log(`versão:  ${version}\n`);

  const current = await readCurrentManifest(s3, credentials.bucket);
  // Republicar a MESMA versão (ex.: acrescentar o MSI depois do .exe) mantém os
  // artefatos já publicados; versão nova começa a lista do zero, senão o
  // download velho continuaria listado sob a versão nova.
  const downloads: Download[] =
    current?.version === version ? [...current.downloads] : [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const meta = FORMATS[ext];
    if (!meta) throw new Error(`Extensão não suportada: ${ext} (${file})`);

    const body = await readFile(file);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const key = `releases/desktop/${version}/${safeName(basename(file))}`;

    if (!dryRun) {
      await s3.send(
        new PutObjectCommand({
          Bucket: credentials.bucket,
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
      `${dryRun ? "[simulação] " : "enviado "}${key} (${(body.length / 1048576).toFixed(1)} MB)`,
    );

    // Reenviar o mesmo formato substitui a entrada em vez de duplicá-la.
    const entry: Download = {
      label: meta.label,
      os: meta.os,
      format: meta.format,
      url: `https://${credentials.publicHost}/${key}`,
      size: body.length,
      sha256,
    };
    const index = downloads.findIndex(
      (d) => d.os === meta.os && d.format === meta.format,
    );
    if (index >= 0) downloads[index] = entry;
    else downloads.push(entry);
  }

  const manifest: Manifest = {
    version,
    publishedAt: new Date().toISOString(),
    ...(notes?.trim()
      ? { notes: notes.trim() }
      : current?.version === version && current.notes
        ? { notes: current.notes }
        : {}),
    downloads,
  };

  if (!dryRun) {
    await s3.send(
      new PutObjectCommand({
        Bucket: credentials.bucket,
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
    dryRun
      ? "\nNada foi enviado. Confira o bucket/domínio acima e rode de novo com SIMULAR = false."
      : "\nPublicado. Confira em /aplicativos · link estável: /api/desktop/download?os=windows",
  );

  return manifest;
}
