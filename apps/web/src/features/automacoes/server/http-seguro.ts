import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Requisição de saída do nó `HTTP_REQUEST`.
 *
 * O nó deixa **o operador** escolher a URL, e quem faz a chamada é o servidor
 * do nerp — de dentro da rede onde ele roda. Sem barreira, isso é SSRF de
 * manual: `http://169.254.169.254/` devolve credencial de instância em nuvem,
 * `http://localhost:5432` alcança o banco, e faixas privadas alcançam o que
 * mais estiver na mesma rede. O Órbita não filtra nada disso.
 *
 * As barreiras:
 *  1. Só `http` e `https` — `file://`, `gopher://` e afins ficam de fora.
 *  2. O host é resolvido e cada endereço conferido contra as faixas privadas,
 *     de loopback e de link-local. Nome público que aponta para 127.0.0.1
 *     também cai aqui.
 *  3. Sem seguir redirecionamento: um 302 para endereço interno passaria por
 *     cima da checagem que já foi feita.
 *  4. Tempo e tamanho limitados — automação não pode segurar um worker.
 *
 * Resta a janela de DNS rebinding (o nome pode responder outro endereço entre
 * a checagem e a conexão). Fechar isso exige conectar por IP fixado, o que
 * quebra TLS por nome e SNI; para um nó de webhook o custo não se paga, e a
 * exposição é registrada aqui de propósito.
 */

export const TEMPO_LIMITE_MS = 10_000;
export const TAMANHO_MAXIMO_DA_RESPOSTA = 64 * 1024;

export class DestinoBloqueadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DestinoBloqueadoError";
  }
}

/**
 * Expande um IPv6 nos seus oito hextets. `null` quando o texto não é um IPv6
 * que saibamos ler.
 *
 * Existe porque comparar prefixo em cima do texto do endereço não funciona: o
 * mesmo endereço se escreve de várias formas, e `::ffff:7f00:1` é o mesmo
 * 127.0.0.1 que `::ffff:127.0.0.1`. Quem classifica precisa dos números.
 */
function hextets(ip: string): number[] | null {
  let texto = ip.toLowerCase();

  // Cauda escrita como IPv4 (`::ffff:127.0.0.1`) vira os dois hextets que ela
  // representa, para o resto da função lidar com um formato só.
  const comCaudaIpv4 = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(texto);
  if (comCaudaIpv4) {
    const octetos = comCaudaIpv4[2].split(".").map(Number);
    if (octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const alto = (octetos[0] << 8) | octetos[1];
    const baixo = (octetos[2] << 8) | octetos[3];
    texto = `${comCaudaIpv4[1]}${alto.toString(16)}:${baixo.toString(16)}`;
  }

  const lados = texto.split("::");
  if (lados.length > 2) return null;

  const emNumeros = (trecho: string) =>
    trecho === "" ? [] : trecho.split(":").map((h) => Number.parseInt(h, 16));

  const cabeca = emNumeros(lados[0]);
  const cauda = lados.length === 2 ? emNumeros(lados[1]) : [];
  const informados = cabeca.length + cauda.length;

  if (informados > 8) return null;
  // Sem `::` o endereço precisa trazer os oito.
  if (lados.length === 1 && informados !== 8) return null;

  const todos = [
    ...cabeca,
    ...new Array(8 - informados).fill(0),
    ...cauda,
  ] as number[];
  if (todos.some((h) => !Number.isInteger(h) || h < 0 || h > 0xffff)) {
    return null;
  }
  return todos;
}

/** Faixas que nunca são um webhook legítimo de cliente. */
function enderecoInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const h = hextets(ip);
    // Endereço que não conseguimos classificar é bloqueado. Falhar fechado é
    // a única resposta segura aqui — o mesmo critério do IPv4 malformado.
    if (!h) return true;

    // `::ffff:a.b.c.d` (mapeado) e `::a.b.c.d` (compatível, obsoleto):
    // os dois chegam no IPv4 correspondente na hora de conectar, então a
    // classificação é a do IPv4. `::` e `::1` caem aqui como 0.0.0.0 e
    // 0.0.0.1, ambos já bloqueados pela regra do `a === 0`.
    const cincoPrimeirosZerados = h.slice(0, 5).every((parte) => parte === 0);
    if (cincoPrimeirosZerados && (h[5] === 0xffff || h[5] === 0)) {
      const [alto, baixo] = [h[6], h[7]];
      return enderecoInterno(
        `${alto >> 8}.${alto & 0xff}.${baixo >> 8}.${baixo & 0xff}`,
      );
    }

    if ((h[0] & 0xffc0) === 0xfe80) return true; // link-local, fe80::/10
    if ((h[0] & 0xfe00) === 0xfc00) return true; // único-local, fc00::/7
    // NAT64 (64:ff9b::/96): o gateway traduz para o IPv4 dos dois últimos
    // hextets, então vale a classificação do IPv4, como no mapeado.
    if (h[0] === 0x64 && h[1] === 0xff9b) {
      const [alto, baixo] = [h[6], h[7]];
      return enderecoInterno(
        `${alto >> 8}.${alto & 0xff}.${baixo >> 8}.${baixo & 0xff}`,
      );
    }
    return false;
  }

  const partes = ip.split(".").map(Number);
  if (partes.length !== 4 || partes.some((p) => Number.isNaN(p))) return true;
  const [a, b] = partes;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // metadados de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast e reservado
  return false;
}

const NOMES_BLOQUEADOS = ["localhost", "metadata.google.internal"];

export async function garantirDestinoPublico(url: string): Promise<URL> {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    throw new DestinoBloqueadoError("Endereço inválido.");
  }

  if (alvo.protocol !== "https:" && alvo.protocol !== "http:") {
    throw new DestinoBloqueadoError("Use um endereço http ou https.");
  }

  const host = alvo.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    NOMES_BLOQUEADOS.includes(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new DestinoBloqueadoError(
      "Esse endereço é da rede interna e não pode ser chamado por uma automação.",
    );
  }

  if (isIP(host) !== 0) {
    if (enderecoInterno(host)) {
      throw new DestinoBloqueadoError(
        "Esse endereço é da rede interna e não pode ser chamado por uma automação.",
      );
    }
    return alvo;
  }

  const resolvidos = await lookup(host, { all: true }).catch(() => {
    throw new DestinoBloqueadoError("Não foi possível resolver esse endereço.");
  });

  if (
    resolvidos.length === 0 ||
    resolvidos.some((r) => enderecoInterno(r.address))
  ) {
    throw new DestinoBloqueadoError(
      "Esse endereço aponta para a rede interna e não pode ser chamado por uma automação.",
    );
  }

  return alvo;
}

export type RespostaDoWebhook = {
  status: number;
  /** Início do corpo, para o operador conferir na tela de execuções. */
  corpo: string;
};

export async function chamarWebhook(input: {
  url: string;
  metodo: "GET" | "POST";
  corpo?: unknown;
}): Promise<RespostaDoWebhook> {
  const alvo = await garantirDestinoPublico(input.url);

  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(alvo, {
      method: input.metodo,
      // Um 302 para endereço interno passaria por cima da checagem acima.
      redirect: "manual",
      headers:
        input.metodo === "POST"
          ? { "content-type": "application/json" }
          : undefined,
      body:
        input.metodo === "POST" ? JSON.stringify(input.corpo ?? {}) : undefined,
      signal: controlador.signal,
    });

    const texto = await resposta.text();
    return {
      status: resposta.status,
      corpo: texto.slice(0, TAMANHO_MAXIMO_DA_RESPOSTA),
    };
  } finally {
    clearTimeout(relogio);
  }
}
