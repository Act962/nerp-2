import prisma from "@/lib/db";

// Repara PdvPhoto que apontam para chaves inexistentes no bucket atual: as
// chaves vieram do banco Neon, cujo bucket é outro, então voltavam 404 e a
// foto simplesmente não aparecia. Testa cada chave distinta uma vez e troca
// só as quebradas, preservando as válidas.

const ORG_SLUG = "gotham";
const PUBLIC_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
if (!PUBLIC_HOST) {
  throw new Error("Falta NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL.");
}

async function isReachable(key: string) {
  try {
    const response = await fetch(`https://${PUBLIC_HOST}/${key}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!organization) throw new Error(`Org ${ORG_SLUG} não encontrada.`);
  const organizationId = organization.id;

  const photos = await prisma.pdvPhoto.findMany({
    where: { organizationId },
    select: { id: true, photos: true },
    orderBy: { capturedAt: "desc" },
  });

  const distinctKeys = [...new Set(photos.flatMap((photo) => photo.photos))];
  const reachability = new Map<string, boolean>();
  for (const key of distinctKeys) {
    reachability.set(key, await isReachable(key));
  }

  const workingKeys = distinctKeys.filter((key) => reachability.get(key));
  const brokenKeys = distinctKeys.filter((key) => !reachability.get(key));
  console.log(
    `chaves: ${workingKeys.length} válidas, ${brokenKeys.length} quebradas`,
  );
  if (brokenKeys.length === 0) return;
  if (workingKeys.length === 0) {
    throw new Error("Nenhuma chave válida para usar como substituta.");
  }

  let repaired = 0;
  for (const [index, photo] of photos.entries()) {
    const fixed = photo.photos.map((key, keyIndex) =>
      reachability.get(key)
        ? key
        : workingKeys[(index + keyIndex) % workingKeys.length],
    );
    const changed = fixed.some(
      (key, keyIndex) => key !== photo.photos[keyIndex],
    );
    if (!changed) continue;
    await prisma.pdvPhoto.update({
      where: { id: photo.id },
      data: { photos: fixed },
    });
    repaired++;
  }
  console.log(`fotos reparadas: ${repaired} de ${photos.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
