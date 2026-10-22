import { describe, expect, it } from "vitest";
import {
  type ClienteLocal,
  type ProdutoLocal,
  planejarClientes,
  planejarEstoque,
  planejarProdutos,
  resumirAcoes,
} from "./importacao";

const produto = (extra: Partial<ProdutoLocal> = {}): ProdutoLocal => ({
  id: "p1",
  erpCode: null,
  barcode: null,
  packQty: null,
  erpActive: null,
  ...extra,
});

describe("planejarProdutos", () => {
  it("casa pelo código do ERP e só preenche o vazio", () => {
    const [acao] = planejarProdutos(
      [
        {
          codigo: "108238",
          nome: "PURELAC 1KG",
          ean: "7898945743488",
          unidadesPorCaixa: 10,
          ativo: true,
        },
      ],
      [produto({ erpCode: "108238", barcode: "7898945743488", packQty: 12 })],
      { criarFaltantes: false },
    );
    // packQty já tinha valor (12): o ERP (10) não sobrescreve.
    expect(acao).toEqual({
      acao: "atualizar",
      id: "p1",
      codigo: "108238",
      vinculou: false,
      campos: ["erpActive"],
      dados: { erpActive: true },
    });
  });

  it("vincula pelo código de barras e preenche o que falta", () => {
    const [acao] = planejarProdutos(
      [
        {
          codigo: "108238",
          nome: "X",
          ean: "7898945743488",
          unidadesPorCaixa: 10,
          ativo: true,
        },
      ],
      [produto({ barcode: "7898945743488" })],
      { criarFaltantes: false },
    );
    expect(acao).toMatchObject({
      acao: "atualizar",
      vinculou: true,
      campos: ["erpCode", "packQty", "erpActive"],
      dados: { erpCode: "108238", packQty: 10, erpActive: true },
    });
  });

  it("não vincula produto que já é de outro código do ERP", () => {
    const [acao] = planejarProdutos(
      [{ codigo: "999", nome: "X", ean: "7898945743488", ativo: true }],
      [produto({ erpCode: "108238", barcode: "7898945743488" })],
      { criarFaltantes: true },
    );
    expect(acao).toMatchObject({
      acao: "ignorar",
      motivo: "conflitoDeVinculo",
    });
  });

  it("só cria faltante quando pedido, e nunca inativo", () => {
    const linhas = [
      { codigo: "1", nome: "Ativo", ean: "7891000053515", ativo: true },
      { codigo: "2", nome: "Inativo", ean: null, ativo: false },
    ];
    expect(
      planejarProdutos(linhas, [], { criarFaltantes: false }).map(
        (a) => a.acao,
      ),
    ).toEqual(["ignorar", "ignorar"]);
    const comCriacao = planejarProdutos(linhas, [], { criarFaltantes: true });
    expect(comCriacao[0]).toMatchObject({
      acao: "criar",
      dados: { ean: "7891000053515" },
    });
    expect(comCriacao[1]).toMatchObject({
      acao: "ignorar",
      motivo: "inativoNoErp",
    });
  });

  it("não reaproveita código de barras já usado por outro produto", () => {
    const acoes = planejarProdutos(
      [
        { codigo: "1", nome: "A", ean: "7891000053515", ativo: true },
        { codigo: "2", nome: "B", ean: "7891000053515", ativo: true },
      ],
      [],
      { criarFaltantes: true },
    );
    expect(acoes[0]).toMatchObject({
      acao: "criar",
      dados: { ean: "7891000053515" },
    });
    expect(acoes[1]).toMatchObject({ acao: "criar", dados: { ean: null } });
  });

  it("acusa código repetido e linha sem código", () => {
    const acoes = planejarProdutos(
      [
        { codigo: "1", nome: "A" },
        { codigo: "1", nome: "A" },
        { codigo: null, nome: "?" },
      ],
      [produto({ erpCode: "1" })],
      { criarFaltantes: false },
    );
    expect(acoes.map((a) => a.acao)).toEqual([
      "semMudanca",
      "ignorar",
      "ignorar",
    ]);
  });
});

const cliente = (extra: Partial<ClienteLocal> = {}): ClienteLocal => ({
  id: "c1",
  erpCode: null,
  document: null,
  email: null,
  phone: null,
  city: null,
  state: null,
  erpBlocked: null,
  ...extra,
});

describe("planejarClientes", () => {
  it("casa pelo CPF/CNPJ mesmo com máscara no NERP e preenche o vazio", () => {
    const [acao] = planejarClientes(
      [
        {
          codigo: "77",
          nome: "MERCADINHO X",
          documento: "11222333000181",
          telefone: "86999990000",
          cidade: "TERESINA",
          uf: "pi",
          bloqueado: true,
          ativo: true,
        },
      ],
      [cliente({ document: "11.222.333/0001-81", phone: "8632220000" })],
      { criarFaltantes: true },
    );
    expect(acao).toMatchObject({
      acao: "atualizar",
      vinculou: true,
      // Telefone já tinha: não troca.
      campos: ["erpCode", "city", "state", "erpBlocked"],
      dados: { erpCode: "77", city: "TERESINA", state: "PI", erpBlocked: true },
    });
  });

  it("mesmo CNPJ em dois códigos do ERP: o segundo vira cadastro próprio", () => {
    const acoes = planejarClientes(
      [
        { codigo: "1", nome: "REDE LOJA 1", documento: "11222333000181" },
        { codigo: "2", nome: "REDE LOJA 2", documento: "11222333000181" },
      ],
      [cliente({ document: "11222333000181" })],
      { criarFaltantes: true },
    );
    expect(acoes[0]).toMatchObject({ acao: "atualizar", vinculou: true });
    expect(acoes[1]).toMatchObject({
      acao: "criar",
      dados: { pessoa: "JURIDICA" },
    });
  });

  it("cria com e-mail só se ele estiver livre na organização", () => {
    const [acao] = planejarClientes(
      [
        {
          codigo: "9",
          nome: "JOSE",
          documento: "529.982.247-25",
          email: "Ja@Usado.com",
        },
      ],
      [cliente({ id: "c2", erpCode: "outro", email: "ja@usado.com" })],
      { criarFaltantes: true },
    );
    expect(acao).toMatchObject({
      acao: "criar",
      dados: { documento: "52998224725", pessoa: "FISICA", email: null },
    });
  });

  it("não casa nem grava documento de enchimento", () => {
    const [acao] = planejarClientes(
      [{ codigo: "1", nome: "CONSUMIDOR FINAL", documento: "111.111.111-11" }],
      [cliente({ document: "11111111111" })],
      { criarFaltantes: true },
    );
    expect(acao).toMatchObject({ acao: "criar", dados: { documento: null } });
  });

  it("não cria cliente inativo no ERP", () => {
    const [acao] = planejarClientes(
      [{ codigo: "5", nome: "ANTIGO", ativo: false }],
      [],
      { criarFaltantes: true },
    );
    expect(acao).toMatchObject({ acao: "ignorar", motivo: "inativoNoErp" });
  });
});

describe("planejarEstoque", () => {
  it("guarda o disponível (total − reservado − bloqueado) de quem existe no NERP", () => {
    const plano = planejarEstoque(
      [
        {
          codigoProduto: "108238",
          filial: "2",
          quantidade: 6800,
          reservada: 1130,
          bloqueada: 1550,
          nomeFilial: "ARMAZEM CARVALHO",
        },
        {
          codigoProduto: "108238",
          filial: "1",
          quantidade: 0,
          reservada: 0,
          bloqueada: 0,
        },
        { codigoProduto: "999", filial: "2", quantidade: 10 },
      ],
      new Map([["108238", "p1"]]),
    );
    expect(plano.registros).toEqual([
      {
        productId: "p1",
        filial: "2",
        nomeFilial: "ARMAZEM CARVALHO",
        disponivel: 4120,
      },
    ]);
    expect(plano.semProduto).toBe(1);
    expect(plano.filiais).toEqual(["1", "2"]);
  });
});

describe("resumirAcoes", () => {
  it("conta por ação e motivo", () => {
    const acoes = planejarProdutos(
      [
        { codigo: "1", nome: "A", ean: "7891000053515", ativo: true },
        { codigo: "2", nome: "B", ativo: false },
      ],
      [produto({ barcode: "7891000053515" })],
      { criarFaltantes: false },
    );
    const resumo = resumirAcoes(acoes, (acao) => acao.acao);
    expect(resumo).toMatchObject({ vincular: 1, ignorar: 1, criar: 0 });
    expect(resumo.ignorados).toEqual([
      { motivo: "Inativo no ERP — não é criado no NERP", quantidade: 1 },
    ]);
  });
});
