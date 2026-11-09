import { ErroFiscal } from "@nerp/fiscal";
import { describe, expect, it } from "vitest";
import {
  type DadosEmpresaFocus,
  EmpresasFocus,
  paraEmpresaFocus,
} from "./empresas";

const dados = (o: Partial<DadosEmpresaFocus> = {}): DadosEmpresaFocus => ({
  cnpj: "11.222.333/0001-81",
  razaoSocial: "Loja Teste Fiscal LTDA",
  nomeFantasia: "Loja Teste",
  inscricaoEstadual: "19.456.789-0",
  inscricaoMunicipal: null,
  regime: "SIMPLES_NACIONAL",
  logradouro: "Av. Frei Serafim",
  numero: "1000",
  complemento: null,
  bairro: "Centro",
  municipio: "Teresina",
  uf: "PI",
  cep: "64000-020",
  telefone: "(86) 3222-0000",
  email: null,
  ambiente: "HOMOLOGACAO",
  certificado: null,
  csc: { id: "1", codigo: "ABC123" },
  serieNfce: 1,
  ...o,
});

describe("paraEmpresaFocus", () => {
  it("manda só dígitos, o regime da Focus e a NFC-e habilitada", () => {
    expect(paraEmpresaFocus(dados())).toEqual({
      cnpj: "11222333000181",
      nome: "Loja Teste Fiscal LTDA",
      nome_fantasia: "Loja Teste",
      inscricao_estadual: "194567890",
      regime_tributario: 1,
      logradouro: "Av. Frei Serafim",
      numero: "1000",
      bairro: "Centro",
      municipio: "Teresina",
      uf: "PI",
      cep: "64000020",
      telefone: "8632220000",
      habilita_nfce: true,
      discrimina_impostos: false,
      serie_nfce_homologacao: "1",
      csc_nfce_homologacao: "ABC123",
      id_token_nfce_homologacao: "1",
    });
  });

  it("CSC e série vão no campo do ambiente; certificado só quando informado", () => {
    const p = paraEmpresaFocus(
      dados({
        ambiente: "PRODUCAO",
        regime: "SIMPLES_MEI",
        certificado: { pfx: Buffer.from("pfx"), senha: "s3nha" },
      }),
    );
    expect(p).toMatchObject({
      regime_tributario: 4,
      serie_nfce_producao: "1",
      csc_nfce_producao: "ABC123",
      arquivo_certificado_base64: Buffer.from("pfx").toString("base64"),
      senha_certificado: "s3nha",
    });
    expect(p).not.toHaveProperty("csc_nfce_homologacao");
    expect(paraEmpresaFocus(dados())).not.toHaveProperty(
      "arquivo_certificado_base64",
    );
  });
});

function focusFalsa(empresas: Record<string, unknown>[] = []) {
  const chamadas: { metodo: string; caminho: string }[] = [];
  const fetchFalso: typeof fetch = async (url, init) => {
    const u = new URL(String(url));
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, caminho: `${u.pathname}${u.search}` });
    const json = (status: number, corpo: unknown) =>
      new Response(JSON.stringify(corpo), { status });
    if (metodo === "GET")
      return json(
        200,
        empresas.filter((e) => e.cnpj === u.searchParams.get("cnpj")),
      );
    if (metodo === "POST")
      return json(201, {
        id: 77,
        token_homologacao: "tok-h",
        token_producao: "",
        certificado_valido_ate: "2027-05-01T00:00:00-03:00",
      });
    const id = u.pathname.split("/").pop();
    if (!empresas.some((e) => String(e.id) === id))
      return json(404, { codigo: "nao_encontrado" });
    return json(200, { id: Number(id), token_homologacao: "tok-h2" });
  };
  return { chamadas, fetch: fetchFalso };
}

describe("EmpresasFocus", () => {
  const pedido = paraEmpresaFocus(dados());

  it("cria quando a empresa não existe e lê os tokens devolvidos", async () => {
    const f = focusFalsa();
    const r = await new EmpresasFocus({
      tokenConta: "t",
      fetch: f.fetch,
    }).salvar(pedido, null);
    expect(r).toEqual({
      criada: true,
      empresa: {
        id: "77",
        tokenHomologacao: "tok-h",
        tokenProducao: null,
        certificadoValidoAte: new Date("2027-05-01T03:00:00.000Z"),
      },
    });
    expect(f.chamadas.map((c) => c.metodo)).toEqual(["GET", "POST"]);
  });

  it("empresa cadastrada à mão no painel é achada pelo CNPJ e atualizada", async () => {
    const f = focusFalsa([{ id: 9, cnpj: "11222333000181" }]);
    const r = await new EmpresasFocus({
      tokenConta: "t",
      fetch: f.fetch,
    }).salvar(pedido, null);
    expect(r).toMatchObject({ criada: false, empresa: { id: "9" } });
    expect(f.chamadas.at(-1)).toEqual({
      metodo: "PUT",
      caminho: "/v2/empresas/9",
    });
  });

  it("ID gravado que sumiu da Focus cai na busca pelo CNPJ", async () => {
    const f = focusFalsa();
    const r = await new EmpresasFocus({
      tokenConta: "t",
      fetch: f.fetch,
    }).salvar(pedido, "123");
    expect(r.criada).toBe(true);
    expect(f.chamadas.map((c) => c.metodo)).toEqual(["PUT", "GET", "POST"]);
  });

  it("422 vira erro com o campo que a Focus apontou", async () => {
    const empresas = new EmpresasFocus({
      tokenConta: "t",
      fetch: async (_url, init) =>
        (init?.method ?? "GET") === "GET"
          ? new Response("[]", { status: 200 })
          : new Response(
              JSON.stringify({
                codigo: "erro_validacao",
                mensagem: "Erro de validação",
                erros: [
                  {
                    campo: "arquivo_certificado_base64",
                    mensagem: "Certificado vencido",
                  },
                ],
              }),
              { status: 422 },
            ),
    });
    const erro = await empresas.salvar(pedido, null).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroFiscal);
    expect(erro.message).toContain(
      "arquivo_certificado_base64: Certificado vencido",
    );
  });
});
