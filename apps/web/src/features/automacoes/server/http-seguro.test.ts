import { describe, expect, it } from "vitest";
import { DestinoBloqueadoError, garantirDestinoPublico } from "./http-seguro";

/**
 * O nó de webhook deixa o operador escolher a URL e quem conecta é o servidor,
 * de dentro da rede. O que este arquivo protege é a lista de formas de escrever
 * um endereço interno — foi por aí que a primeira versão passou: ela só
 * reconhecia IPv4 embutido em IPv6 quando escrito em decimal pontuado, e
 * `::ffff:a9fe:a9fe` (o mesmo 169.254.169.254 dos metadados de nuvem) passava.
 */

const bloqueado = (url: string) =>
  expect(garantirDestinoPublico(url)).rejects.toBeInstanceOf(
    DestinoBloqueadoError,
  );

describe("garantirDestinoPublico", () => {
  it("recusa esquema que não seja http ou https", async () => {
    await bloqueado("file:///etc/passwd");
    await bloqueado("gopher://exemplo.com/");
  });

  it("recusa loopback e faixas privadas em IPv4", async () => {
    await bloqueado("http://127.0.0.1:5432/");
    await bloqueado("http://10.0.0.5/");
    await bloqueado("http://192.168.1.1/");
    await bloqueado("http://172.16.0.1/");
    await bloqueado("http://100.64.0.1/");
    await bloqueado("http://0.0.0.0/");
  });

  it("recusa os metadados de nuvem", async () => {
    await bloqueado("http://169.254.169.254/latest/meta-data/");
  });

  it("recusa nomes que apontam para dentro", async () => {
    await bloqueado("http://localhost:3000/");
    await bloqueado("http://metadata.google.internal/");
    await bloqueado("http://banco.local/");
    await bloqueado("http://api.internal/");
  });

  it("recusa IPv6 de loopback, link-local e único-local", async () => {
    await bloqueado("http://[::1]/");
    await bloqueado("http://[fe80::1]/");
    await bloqueado("http://[febf::1]/");
    await bloqueado("http://[fc00::1]/");
    await bloqueado("http://[fd12:3456::1]/");
  });

  // A regressão: as duas escritas são o MESMO endereço, e antes só a primeira
  // era reconhecida.
  it("recusa IPv4 mapeado em IPv6, em decimal e em hexadecimal", async () => {
    await bloqueado("http://[::ffff:127.0.0.1]/");
    await bloqueado("http://[::ffff:7f00:1]/");
    await bloqueado("http://[::ffff:169.254.169.254]/");
    await bloqueado("http://[::ffff:a9fe:a9fe]/");
    await bloqueado("http://[0:0:0:0:0:ffff:7f00:0001]/");
    await bloqueado("http://[::ffff:c0a8:1]/"); // 192.168.0.1
    await bloqueado("http://[::ffff:a00:1]/"); // 10.0.0.1
  });

  it("recusa a forma compatível obsoleta e o NAT64", async () => {
    await bloqueado("http://[::127.0.0.1]/");
    await bloqueado("http://[64:ff9b::a9fe:a9fe]/");
  });

  it("bloqueia IPv6 que não sabemos ler, em vez de deixar passar", async () => {
    await bloqueado("http://[::ffff:1:2:3:4:5:6:7]/");
  });

  it("aceita endereço público", async () => {
    const alvo = await garantirDestinoPublico("https://8.8.8.8/webhook");
    expect(alvo.hostname).toBe("8.8.8.8");
  });

  it("preserva caminho e query do destino aprovado", async () => {
    const alvo = await garantirDestinoPublico("https://1.1.1.1/hook?a=1");
    expect(alvo.pathname).toBe("/hook");
    expect(alvo.search).toBe("?a=1");
  });
});
