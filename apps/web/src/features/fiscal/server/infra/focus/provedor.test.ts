import {
  ErroFiscal,
  ProvedorIndisponivelError,
  TP_EMIS,
  montarChave,
} from "@nerp/fiscal";
import { notaDeExemplo } from "@nerp/fiscal/testes";
import { testarContratoDoProvedorFiscal } from "@nerp/fiscal/testes/contrato";
import { describe, expect, it } from "vitest";
import type { PedidoNfceFocus } from "./mapeador";
import { ProvedorFocus } from "./provedor";

/**
 * Uma Focus de mentira que responde no formato documentado em
 * doc.focusnfe.com.br (POST/GET/DELETE /v2/nfce). Prova que o adaptador cumpre
 * o contrato de `ProvedorFiscal` com as respostas que a Focus devolve — a
 * prova contra a Focus de verdade é o mesmo contrato rodando em homologação.
 */
type Registro = { corpo: Record<string, string>; xml: string | null };

function focusFalsa() {
  const notas = new Map<string, Registro>();
  let protocolos = 0;
  const json = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const fetchFalso: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    const metodo = init?.method ?? "GET";
    const xmlMatch = /^\/arquivos\/(.+)\.xml$/.exec(url.pathname);
    if (xmlMatch) {
      const nota = notas.get(decodeURIComponent(xmlMatch[1]));
      return nota?.xml
        ? new Response(nota.xml)
        : new Response("", { status: 404 });
    }

    if (metodo === "POST" && url.pathname === "/v2/nfce/inutilizacao") {
      const pedido = JSON.parse(String(init?.body)) as Record<string, string>;
      const usado = [...notas.values()].some(
        (n) =>
          n.corpo.status !== "erro_autorizacao" &&
          n.corpo.serie === pedido.serie &&
          Number(n.corpo.numero) >= Number(pedido.numero_inicial) &&
          Number(n.corpo.numero) <= Number(pedido.numero_final),
      );
      const base = {
        cnpj: pedido.cnpj,
        modelo: "65",
        serie: pedido.serie,
        numero_inicial: pedido.numero_inicial,
        numero_final: pedido.numero_final,
      };
      if (usado)
        return json(200, {
          ...base,
          status: "erro_autorizacao",
          status_sefaz: "241",
          mensagem_sefaz: "Rejeição: Um número da faixa já foi utilizado",
        });
      protocolos += 1;
      return json(200, {
        ...base,
        status: "autorizado",
        status_sefaz: "102",
        mensagem_sefaz: "Inutilizacao de numero homologado",
        // XML que não existe: o evento vale mesmo sem o arquivo.
        caminho_xml: "/arquivos/inexistente.xml",
        protocolo_sefaz: `1352100022${String(protocolos).padStart(5, "0")}`,
      });
    }

    if (metodo === "POST") {
      const ref = url.searchParams.get("ref") ?? "";
      const atual = notas.get(ref);
      if (atual?.corpo.status === "autorizado")
        return json(422, {
          codigo: "already_processed",
          mensagem: "A nota fiscal já foi autorizada",
        });
      const pedido = JSON.parse(String(init?.body)) as PedidoNfceFocus;
      if (pedido.items.some((i) => i.codigo_ncm === "00000000")) {
        notas.set(ref, {
          corpo: {
            ref,
            status: "erro_autorizacao",
            status_sefaz: "778",
            mensagem_sefaz: "Rejeição: Informado NCM inexistente",
          },
          xml: null,
        });
        return json(201, notas.get(ref)?.corpo);
      }
      const chave = montarChave({
        uf: "PI",
        dhEmi: pedido.data_emissao,
        cnpj: pedido.cnpj_emitente,
        modelo: 65,
        serie: Number(pedido.serie),
        numero: Number(pedido.numero),
        tpEmis: TP_EMIS.NORMAL,
        cNF: "87654321",
      });
      protocolos += 1;
      const protocolo = `2222600000${String(protocolos).padStart(5, "0")}`;
      notas.set(ref, {
        corpo: {
          ref,
          status: "autorizado",
          status_sefaz: "100",
          mensagem_sefaz: "Autorizado o uso da NF-e",
          chave_nfe: `NFe${chave}`,
          numero: pedido.numero,
          serie: pedido.serie,
          caminho_xml_nota_fiscal: `/arquivos/${encodeURIComponent(ref)}.xml`,
          qrcode_url: `http://www.sefaz.pi.gov.br/nfce/qrcode?p=${chave}|3|2`,
          url_consulta_nf: "http://www.sefaz.pi.gov.br/nfce/consulta",
        },
        xml: `<nfeProc><protNFe><infProt><dhRecbto>2026-11-03T10:00:01-03:00</dhRecbto><nProt>${protocolo}</nProt></infProt></protNFe></nfeProc>`,
      });
      return json(201, notas.get(ref)?.corpo);
    }

    const ref = decodeURIComponent(url.pathname.replace("/v2/nfce/", ""));
    const nota = notas.get(ref);
    if (!nota)
      return json(404, {
        codigo: "nfce_nao_encontrada",
        mensagem: "NFC-e não encontrada.",
      });
    if (metodo === "DELETE") {
      if (nota.corpo.status !== "autorizado")
        return json(422, {
          codigo: "nfe_nao_autorizada",
          mensagem: "Nota fiscal não autorizada",
        });
      nota.corpo = { ...nota.corpo, status: "cancelado", status_sefaz: "135" };
      return json(200, {
        status: "cancelado",
        status_sefaz: "135",
        numero_protocolo: "222260000099999",
      });
    }
    return json(200, nota.corpo);
  };

  return { fetchFalso, notas };
}

let numero = 0;
const novaRef = () => `ref-${++numero}-${Math.random().toString(36).slice(2)}`;

testarContratoDoProvedorFiscal("Focus (respostas documentadas)", {
  criarProvedor: () =>
    new ProvedorFocus({
      token: "t",
      ambiente: "HOMOLOGACAO",
      fetch: focusFalsa().fetchFalso,
    }),
  notaValida: () => notaDeExemplo(),
  notaRejeitavel: () => {
    const nota = notaDeExemplo();
    nota.itens[0] = { ...nota.itens[0], ncm: "00000000" };
    return nota;
  },
  proximaNumeracao: () => ({ serie: 1, numero: ++numero }),
  novaRef,
});

const solicitacao = () => ({
  ref: novaRef(),
  serie: 1,
  numero: ++numero,
  emitidaEm: new Date("2026-11-03T13:00:00.000Z"),
  nota: notaDeExemplo(),
});

describe("ProvedorFocus", () => {
  it("lê protocolo e data de autorização do XML autorizado", async () => {
    const { fetchFalso } = focusFalsa();
    const p = new ProvedorFocus({
      token: "t",
      ambiente: "HOMOLOGACAO",
      fetch: fetchFalso,
    });
    const r = await p.emitir(solicitacao());
    expect(r).toMatchObject({
      situacao: "AUTORIZADA",
      protocolo: "222260000000001",
      autorizadaEm: new Date("2026-11-03T13:00:01.000Z"),
      consultaUrl: "http://www.sefaz.pi.gov.br/nfce/consulta",
      danfe: null,
    });
    if (r.situacao === "AUTORIZADA")
      expect(r.xml?.contentType).toBe("application/xml");
  });

  it("5xx e falha de rede viram ProvedorIndisponivelError (vão para o retry)", async () => {
    const fora = new ProvedorFocus({
      token: "t",
      ambiente: "HOMOLOGACAO",
      fetch: async () => new Response("erro", { status: 503 }),
    });
    await expect(fora.emitir(solicitacao())).rejects.toBeInstanceOf(
      ProvedorIndisponivelError,
    );

    const semRede = new ProvedorFocus({
      token: "t",
      ambiente: "HOMOLOGACAO",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(semRede.consultar("x", 65)).rejects.toBeInstanceOf(
      ProvedorIndisponivelError,
    );
  });

  it("credencial recusada é erro de configuração, não queda", async () => {
    const p = new ProvedorFocus({
      token: "errado",
      ambiente: "HOMOLOGACAO",
      fetch: async () =>
        new Response("HTTP Basic: Access denied.", { status: 401 }),
    });
    const erro = await p.emitir(solicitacao()).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroFiscal);
    expect(erro).not.toBeInstanceOf(ProvedorIndisponivelError);
    expect(erro.codigo).toBe("PROVEDOR_CREDENCIAL");
  });

  it("inutilização manda os campos como texto e guarda o XML do evento", async () => {
    const corpos: unknown[] = [];
    const p = new ProvedorFocus({
      token: "t",
      ambiente: "HOMOLOGACAO",
      fetch: async (url, init) => {
        if (String(url).endsWith("/inut.xml"))
          return new Response("<procInutNFe/>");
        corpos.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            status: "autorizado",
            status_sefaz: "102",
            protocolo_sefaz: "135210002233889",
            caminho_xml: "/arquivos/inut.xml",
          }),
          { status: 200 },
        );
      },
    });
    const r = await p.inutilizar({
      modelo: 65,
      cnpj: "11222333000181",
      serie: 1,
      numeroInicial: 7,
      numeroFinal: 9,
      justificativa: "Numeros pulados por queda do sistema",
    });
    expect(corpos[0]).toEqual({
      cnpj: "11222333000181",
      serie: "1",
      numero_inicial: "7",
      numero_final: "9",
      justificativa: "Numeros pulados por queda do sistema",
    });
    expect(r).toMatchObject({
      situacao: "INUTILIZADA",
      protocolo: "135210002233889",
    });
    if (r.situacao === "INUTILIZADA")
      expect(new TextDecoder().decode(r.xml?.bytes)).toBe("<procInutNFe/>");
  });

  it("autentica com o token como usuário do Basic e fala com a homologação", async () => {
    const chamadas: { url: string; auth: string | null }[] = [];
    const p = new ProvedorFocus({
      token: "meu-token",
      ambiente: "HOMOLOGACAO",
      fetch: async (url, init) => {
        chamadas.push({
          url: String(url),
          auth: new Headers(init?.headers).get("Authorization"),
        });
        return new Response(JSON.stringify({ codigo: "nfce_nao_encontrada" }), {
          status: 404,
        });
      },
    });
    await p.consultar("abc", 65).catch(() => {});
    expect(chamadas[0]).toEqual({
      url: "https://homologacao.focusnfe.com.br/v2/nfce/abc",
      auth: `Basic ${Buffer.from("meu-token:").toString("base64")}`,
    });
  });
});
