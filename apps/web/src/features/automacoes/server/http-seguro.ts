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

/** Faixas que nunca são um webhook legítimo de cliente. */
function enderecoInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const normalizado = ip.toLowerCase();
    if (normalizado === "::1" || normalizado === "::") return true;
    // Link-local (fe80::/10) e único-local (fc00::/7).
    if (normalizado.startsWith("fe8") || normalizado.startsWith("fe9"))
      return true;
    if (normalizado.startsWith("fea") || normalizado.startsWith("feb"))
      return true;
    if (normalizado.startsWith("fc") || normalizado.startsWith("fd"))
      return true;
    // IPv4 embutido em IPv6 (::ffff:127.0.0.1).
    const embutido = normalizado.split(":").pop() ?? "";
    if (embutido.includes(".")) return enderecoInterno(embutido);
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
