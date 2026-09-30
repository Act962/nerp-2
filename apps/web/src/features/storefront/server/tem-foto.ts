import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { constructUrl } from "@/hooks/use-construct-url";

/** Foto boa é reconferida de tempos em tempos; a quebrada, mais cedo. */
const VALIDADE_DA_FOTO_BOA = 6 * 60 * 60 * 1000;
const VALIDADE_DA_FOTO_QUEBRADA = 60 * 60 * 1000;
const TEMPO_DO_HEAD = 5000;
const CONFERENCIAS_EM_PARALELO = 8;

type Conferencia = { existe: boolean; em: number };

const arquivosLocais = new Map<string, boolean>();
const remotas = new Map<string, Conferencia>();
const emAndamento = new Map<string, Promise<void>>();

function vencida(conferencia: Conferencia | undefined): boolean {
  if (!conferencia) return true;
  const validade = conferencia.existe
    ? VALIDADE_DA_FOTO_BOA
    : VALIDADE_DA_FOTO_QUEBRADA;
  return Date.now() - conferencia.em > validade;
}

/**
 * O produto tem uma foto que abre?
 *
 * Caminho local (`/teste-produtos/p1.png`) é conferido no disco: o seed
 * apontou produtos para arquivos que não vieram junto. Chave do storage
 * responde com o que `conferirFotos` já descobriu — enquanto não se sabe,
 * conta como foto, porque esconder produto por dúvida é pior que mostrar um
 * cartão com a imagem padrão.
 */
export function temFoto(thumbnail: string | null | undefined): boolean {
  const chave = thumbnail?.trim();
  if (!chave) return false;
  if (chave.startsWith("data:")) return true;

  if (chave.startsWith("/")) {
    const guardado = arquivosLocais.get(chave);
    if (guardado !== undefined) return guardado;
    const existe = existsSync(join(process.cwd(), "public", chave));
    arquivosLocais.set(chave, existe);
    return existe;
  }

  return remotas.get(chave)?.existe ?? true;
}

async function conferir(chave: string): Promise<void> {
  const url = constructUrl(chave);
  if (!url) return;
  try {
    const resposta = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_DO_HEAD),
    });
    // Só 404/410 condenam a foto. Erro 5xx, 403 de CDN ou falha de rede é
    // problema do caminho, não do arquivo — marcar como quebrada esconderia
    // produto bom num soluço do storage.
    if (resposta.ok) remotas.set(chave, { existe: true, em: Date.now() });
    else if (resposta.status === 404 || resposta.status === 410) {
      remotas.set(chave, { existe: false, em: Date.now() });
    }
  } catch {
    // Fica como estava; a próxima listagem tenta de novo.
  }
}

/**
 * Confere no storage as fotos que ainda não foram vistas (ou venceram).
 *
 * Um HEAD por foto, sem baixar a imagem, poucas por vez. Espera no máximo
 * `esperarAte` ms: a listagem não pode travar por causa do storage, e o que
 * não voltar a tempo continua sendo conferido e vale na próxima visita.
 */
export async function conferirFotos(
  thumbnails: readonly (string | null | undefined)[],
  { esperarAte = 1500 }: { esperarAte?: number } = {},
): Promise<void> {
  const pendentes = [
    ...new Set(
      thumbnails
        .map((thumbnail) => thumbnail?.trim() ?? "")
        .filter(
          (chave) =>
            chave !== "" &&
            !chave.startsWith("/") &&
            !chave.startsWith("data:") &&
            vencida(remotas.get(chave)),
        ),
    ),
  ];
  if (pendentes.length === 0) return;

  const fila = [...pendentes];
  const trabalhador = async () => {
    for (let chave = fila.shift(); chave; chave = fila.shift()) {
      const existente = emAndamento.get(chave);
      if (existente) {
        await existente;
        continue;
      }
      const conferencia = conferir(chave).finally(() =>
        emAndamento.delete(chave),
      );
      emAndamento.set(chave, conferencia);
      await conferencia;
    }
  };
  const tudo = Promise.all(
    Array.from(
      { length: Math.min(CONFERENCIAS_EM_PARALELO, pendentes.length) },
      trabalhador,
    ),
  );

  await Promise.race([
    tudo,
    new Promise<void>((resolver) => setTimeout(resolver, esperarAte)),
  ]);
}
